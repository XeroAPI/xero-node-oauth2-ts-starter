// @ts-nocheck
import 'dotenv/config' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import express, { Request, Response } from 'express'
import jwtDecode from 'jwt-decode';
// import { TokenSet } from 'openid-client';
import { XeroAccessToken, TokenSet, XeroIdToken, XeroClient, Contact, LineItem, Invoice, Invoices, Phone, Contacts } from 'xero-node';
import session from 'express-session';
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore/lite';

const firebaseConfig = {
  apiKey: process.env.VUE_APP_API_KEY,
  authDomain: process.env.VUE_APP_AUTH_DOMAIN,
  projectId: process.env.VUE_APP_PROJECT_ID,
  storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_ID,
  measurementId: process.env.VUE_APP_MEASUREMENT_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const clientId: string = process.env.CLIENT_ID;
const clientSecret: string = process.env.CLIENT_SECRET;
const redirectUrl: string = process.env.REDIRECT_URI;
const scopes: string[] = [
  'openid',
  'profile',
  'email',
  'accounting.settings',
  'accounting.reports.read',
  'accounting.journals.read',
  'accounting.contacts',
  'accounting.attachments',
  'accounting.transactions',
  'offline_access'
]

const xero = new XeroClient({
	clientId,
	clientSecret,
	redirectUris: [redirectUrl],
	scopes,
});
xero.initialize()

const app: express.Application = express();

app.use(express.static(__dirname + '/build'));

app.use(session({
	secret: process.env.SECRET, //TODO: randomly generated secret
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false },
}));

async function authenticate(req: Request): Promise<any> {
	const docRef = doc(db, "users", USER_EMAIL);
	const docSnap = await getDoc(docRef);
	let oldToken = null
	if(docSnap.data().xeroToken) {
		oldToken = JSON.parse(docSnap.data().xeroToken);
		// TODO: Check if token doesn't exist, redirect to connect url
	} else {
		console.log("No such document!");
		console.log("Redirecting to connect url");
		// const consentUrl: string = await xero.buildConsentUrl();
		// res.redirect(consentUrl);
	}

	xero.setTokenSet(oldToken);
	let tokenSet: TokenSet = xero.readTokenSet();
	console.log(tokenSet.expired() ? 'expired' : 'valid');

	if(tokenSet.expired()) {
		console.log('expired. refreshing now')
		tokenSet = await xero.refreshWithRefreshToken(clientId, clientSecret, tokenSet.refresh_token);
		xero.setTokenSet(tokenSet);
		// save the new tokenset
		const dbUserRef = doc(db, 'users', USER_EMAIL)
		await updateDoc(dbUserRef, { xeroToken: JSON.stringify(tokenSet) })
	}

	const decodedIdToken: XeroIdToken = jwtDecode(tokenSet.id_token);
	const decodedAccessToken: XeroAccessToken = jwtDecode(tokenSet.access_token);
	await xero.updateTenants()
	req.session.decodedIdToken = decodedIdToken;
	req.session.decodedAccessToken = decodedAccessToken;
	req.session.tokenSet = tokenSet;
	req.session.allTenants = xero.tenants;
	// XeroClient is sorting tenants behind the scenes so that most recent / active connection is at index 0
	req.session.activeTenant = xero.tenants[0];
}

async function getContact(req) {
	const contacts = await xero.accountingApi.getContacts(req.session.activeTenant.tenantId, undefined, `EmailAddress="${job.client.emailAddress}"`);
	if (contacts.body.contacts.length > 0) {
		return contacts.body.contacts[0].contactID
	} else {
		const contact: Contact = {
			name: job.client.contactName,
			emailAddress: job.client.emailAddress,
			phones: [
				{
					phoneNumber:job.client.contactNumber,
					phoneType: Phone.PhoneTypeEnum.MOBILE
				}
			]
		};
		const contacts: Contacts = {  
			contacts: [contact]
		}; 
		return (await xero.accountingApi.createContacts(req.session.activeTenant.tenantId, contacts)).body.contacts[0];
	}
}

// const authenticationData: any = (req: Request, res: Response) => {

// 	return {
// 		decodedIdToken: req.session.decodedIdToken,
// 		decodedAccessToken: req.session.decodedAccessToken,
// 		tokenSet: req.session.tokenSet,
// 		allTenants: req.session.allTenants,
// 		activeTenant: req.session.activeTenant,
// 	};
// };

app.get('/', (req: Request, res: Response) => {
	res.send(`<a href='/connect'>Connect to Xero</a>`);
});

app.get('/connect', async (req: Request, res: Response) => {
	try {
		const consentUrl: string = await xero.buildConsentUrl();
		res.redirect(consentUrl);
	} catch (err) {
		res.send('Sorry, something went wrong (connect)');
	}
});

app.get('/callback', async (req: Request, res: Response) => {
	try {
		console.log('calling back')
		const tokenSet: TokenSet = await xero.apiCallback(req.url);
		console.log('updating tenants')
		await xero.updateTenants();

		// Setting xero tokenSet to firestore
		// TODO: Get user uid from req.url param to set tokenSet to firestore
		const dbUserRef = doc(db, 'users', USER_EMAIL)
		await updateDoc(dbUserRef, { xeroToken: JSON.stringify(tokenSet) })

		// TODO: Redirect to Accounts dashboard?
		res.redirect('/organisation');
	} catch (err) {
		res.send('Sorry, something went wrong (callback)');
	}
});

app.get('/organisation', async (req: Request, res: Response) => {
	try {
		req: Request = await authenticate(req);
		const response: any = await xero.accountingApi.getOrganisations(req.session.activeTenant.tenantId);
		res.send(`Hello, ${response.body.organisations[0].name}`);
	} catch (err) {	
		console.log(err)
		res.send('Sorry, something went wrong');
	}
});


app.get("/invoice", async (req: Request, res: Response) => {
	// TODO: Pass dbUser uid to authenticate function
	console.log("authenticating")
	req: Request = await authenticate(req);
	// TODO: pass contact details to getContacts function
	console.log("check if contact exists. Create one if not")
	let contact: Contact = await getContact(req)

	try {
		let lineItems = job.routes.map(route => route.vehicles.map(vehicle => {
			const car = `${vehicle.car} / ${route.freightCode.code}`;
			const lineItem: LineItem = {
				description: route.po ? `PO: ${route.po} Vehicle: ${car}` : `${car}`,
				quantity: 1,
				unitAmount: route.freightCode.cost,
				accountCode: "200",
				taxType: "OUTPUT",
				taxAmount: route.freightCode.cost * 0.1
			}
			return lineItem
		})).flat();
		const invoices: Invoice[] = [{
			type: Invoice.TypeEnum.ACCREC,
			reference: `PO Numbers: ${job.routes.map(route => route.po).join(', ')}`,
			lineItems,
			contact,
			lineAmountTypes: 'Exclusive',
			// invoiceNumber: job.jobNumber,
			invoiceNumber: Date.now().toString(),
			DueDate: Date.now() + 604800,
			Date: Date.now(),
		}];
		// TODO: add optional properties to invoice object:
		// 	status: "AUTHORISED",

		const response = await xero.accountingApi.createInvoices(req.session.activeTenant.tenantId, { invoices });
		// console.log('invoices: ', response.body.invoices);
		res.json(response.body.invoices);
	} catch (err) {
		console.log('error')
		res.json(err);
	}
});

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});