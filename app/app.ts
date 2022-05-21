// @ts-nocheck
import 'dotenv/config' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import express, { Request, Response } from 'express'
import jwtDecode from 'jwt-decode';
// import { TokenSet } from 'openid-client';
import { XeroAccessToken, TokenSet, XeroIdToken, XeroClient, Contact, LineItem, Invoice, Invoices, Phone, Contacts } from 'xero-node';
import session from 'express-session';
//libraries for posting data
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

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
	secret: process.env.SECRET,
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false },
}));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Credentials",
    true
  );
  res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");

  next();
});

function flatten(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
}

async function authenticate(req: Request): Promise<any> {
	// TODO: get token from session
	// check if exists
	// if yes, parse token
  
	let oldToken = null
  oldToken = req.body.token
  
  // if not, redirect to connect url
	// } else {
	// 	console.log("No such document!");
	// 	console.log("Redirecting to connect url");
	// 	// const consentUrl: string = await xero.buildConsentUrl();
	// 	// res.redirect(consentUrl);
	// }

	xero.setTokenSet(oldToken);
	let tokenSet: TokenSet = xero.readTokenSet();
	console.log(tokenSet.expired() ? 'expired' : 'valid');

	if(tokenSet.expired()) {
		console.log('expired. refreshing now')
		tokenSet = await xero.refreshWithRefreshToken(clientId, clientSecret, tokenSet.refresh_token);
		xero.setTokenSet(tokenSet);
    // TODO: If too expired, redirect to consent url
	}

	const decodedIdToken: XeroIdToken = jwtDecode(tokenSet.id_token);
	const decodedAccessToken: XeroAccessToken = jwtDecode(tokenSet.access_token);
	await xero.updateTenants()
	req.session.decodedIdToken = decodedIdToken;
	req.session.decodedAccessToken = decodedAccessToken;
	req.session.tokenSet = tokenSet;
	req.session.allTenants = xero.tenants;
	req.session.activeTenant = xero.tenants[0];
}

async function getContact(req) {
  const job = req.body.job
	const contacts = await xero.accountingApi.getContacts(req.session.activeTenant.tenantId, undefined, `EmailAddress="${job.client.emailAddress}"`);
	if (contacts.body.contacts.length > 0) {
		return contacts.body.contacts[0].contactID
	} else {
		const contact: Contact = {
			name: job.client.contactName,
			emailAddress: job.client.emailAddress,
			phones: [{
        phoneNumber:job.client.contactNumber,
        phoneType: Phone.PhoneTypeEnum.MOBILE
      }]
		};
		const contacts: Contacts = {  
			contacts: [contact]
		}; 
		return (await xero.accountingApi.createContacts(req.session.activeTenant.tenantId, contacts)).body.contacts[0];
	}
}

function generateInvoice(req, contact) {
  const job = req.body.job
  let lineItems = flatten(job.routes.map(route => route.vehicles.map(vehicle => {
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
  })));
  
  return [{
    type: Invoice.TypeEnum.ACCREC,
    reference: `PO Numbers: ${job.routes.map(route => route.po).join(', ')}`,
    lineItems,
    contact: { contactID: contact },
    lineAmountTypes: 'Exclusive', // GST exclusive
    // TODO: set invoice number for production
    // invoiceNumber: job.jobNumber,
    invoiceNumber: Date.now().toString(),
    DueDate: Date.now() + 604800,
    Date: Date.now(),
  }];
}

app.get('/', (req: Request, res: Response) => {
	res.send(`<a href='/connect'>Connect to Xero meow meow</a>`);
});

app.get('/connect', async (req: Request, res: Response) => {
	try {
		const consentUrl: string = await xero.buildConsentUrl();
    console.log('connecting')
    res.status(200);
    res.json({ url: consentUrl });    
	} catch (err) {
		res.send('Sorry, something went wrong (connect)');
	}
});

app.get('/callback', async (req: Request, res: Response) => {
	try {
		console.log('calling back')
		const tokenSet: TokenSet = await xero.apiCallback(req.url);
		await xero.updateTenants();
    
    console.log('converting token to cookie string uri')
    const tokenString = encodeURI(JSON.stringify(tokenSet))
    // Set Cookie:
    res.cookie('xeroToken', tokenString, { maxAge: 900000, httpOnly: true });

		// TODO: Redirect to https://goochtransport.netlify.app/#/accounts if Xero tokenSet exists
    // Else redirect to consent url
    // res.redirect('https://goochtransport.netlify.app/#/accounts')
    res.redirect(`http://localhost:8080/#/dev?src=${tokenString}`)
    // TODO: clear the cookie
	} catch (err) {
		res.send('Sorry, something went wrong (callback)');
	}
});

app.post("/postinvoice", async (req: Request, res: Response) => {
	req: Request = await authenticate(req);
	try {
    const contact: Contact = await getContact(req)
	  const invoices = generateInvoice(req, contact)	
		const response = await xero.accountingApi.createInvoices(req.session.activeTenant.tenantId, { invoices });
    response.body.tokenSet = req.session.tokenSet
		res.json(response.body);
	} catch (err) {
		console.log('error in /postinvoice')
		res.json(err);
	}
})

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});