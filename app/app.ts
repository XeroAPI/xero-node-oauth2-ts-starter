require('dotenv').config();
import express from 'express';
import { Request, Response } from 'express';
import * as bodyParser from "body-parser";
import * as crypto from 'crypto';
import jwtDecode from 'jwt-decode';
import { TokenSet } from 'openid-client';
import { XeroAccessToken, XeroIdToken, XeroClient, Contact, LineItem, Invoice, Invoices, Phone, Contacts } from 'xero-node';

const session = require('express-session');

const client_id: string = process.env.CLIENT_ID;
const client_secret: string = process.env.CLIENT_SECRET;
const redirectUrl: string = process.env.REDIRECT_URI;
const scopes: string = 'openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access';

const xero = new XeroClient({
	clientId: client_id,
	clientSecret: client_secret,
	redirectUris: [redirectUrl],
	scopes: scopes.split(' '),
});

if (!client_id || !client_secret || !redirectUrl) {
	throw Error('Environment Variables not all set - please check your .env file in the project root or create one!')
}

const app: express.Application = express();

app.use(express.static(__dirname + '/build'));

app.use(session({
	secret: 'something crazy',
	resave: false,
	saveUninitialized: true,
	cookie: { secure: false },
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use('/webhooks', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json());

const authenticationData: any = (req: Request, res: Response) => {
	return {
		decodedIdToken: req.session.decodedIdToken,
		decodedAccessToken: req.session.decodedAccessToken,
		tokenSet: req.session.tokenSet,
		allTenants: req.session.allTenants,
		activeTenant: req.session.activeTenant,
	};
};

const randomNumber = (range) =>  {
	return Math.round(Math.random() * ((range || 100) - 1) + 1);
}

const verifyWebhookEventSignature = (req: Request) => {
	let computedSignature = crypto.createHmac('sha256', process.env.WEBHOOK_KEY).update(req.body.toString()).digest('base64');
	let xeroSignature = req.headers['x-xero-signature'];

	if (xeroSignature === computedSignature) {
		console.log('Signature passed! This is from Xero!');
		return true;
	} else {
		// If this happens someone who is not Xero is sending you a webhook
		console.log('Signature failed. Webhook might not be from Xero or you have misconfigured something...');
		console.log(`Got {${computedSignature}} when we were expecting {${xeroSignature}}`);
		return false;
	}
};

app.get('/', (req: Request, res: Response) => {
	res.send(`<a href='/connect'>Connect to Xero</a>`);
});

app.get('/connect', async (req: Request, res: Response) => {
	try {
		const consentUrl: string = await xero.buildConsentUrl();
		res.redirect(consentUrl);
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/callback', async (req: Request, res: Response) => {
	try {
		const tokenSet: TokenSet = await xero.apiCallback(req.url);
		await xero.updateTenants();

		const decodedIdToken: XeroIdToken = jwtDecode(tokenSet.id_token);
		const decodedAccessToken: XeroAccessToken = jwtDecode(tokenSet.access_token);

		req.session.decodedIdToken = decodedIdToken;
		req.session.decodedAccessToken = decodedAccessToken;
		req.session.tokenSet = tokenSet;
		req.session.allTenants = xero.tenants;
		// XeroClient is sorting tenants behind the scenes so that most recent / active connection is at index 0
		req.session.activeTenant = xero.tenants[0];

		const authData: any = authenticationData(req, res);

		console.log(authData);

		res.redirect('/organisation');
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/organisation', async (req: Request, res: Response) => {
	try {
		const tokenSet: TokenSet = await xero.readTokenSet();
		console.log(tokenSet.expired() ? 'expired' : 'valid');
		const response: any = await xero.accountingApi.getOrganisations(req.session.activeTenant.tenantId);
		res.send(`Hello, ${response.body.organisations[0].name}`);
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/contact', async (req: Request, res: Response) => {
	try {
		const contact: Contact = {
			name: `Bruce Banner ${randomNumber(100)}`,
			emailAddress: "hulk@avengers.com",
			phones: [
				{
					phoneNumber:'555-555-5555',
					phoneType: Phone.PhoneTypeEnum.MOBILE
				}
			]
		};
		const contacts: Contacts = {  
			contacts: [contact]
		}; 
		const response = await xero.accountingApi.createContacts(req.session.activeTenant.tenantId, contacts);
		console.log('contacts: ', response.body.contacts);
		res.json(response.body.contacts);
	} catch (err) {
		res.json(err);
	}
});

app.post("/webhooks", async (req: Request, res: Response) => {
	console.log("webhook event received!", req.headers, req.body, JSON.parse(req.body));
	verifyWebhookEventSignature(req) ? res.status(200).send() : res.status(401).send();
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});