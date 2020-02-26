require('dotenv').config();
import express from 'express';
import { Request, Response } from 'express';
import jwtDecode from 'jwt-decode';
import { Account, BankTransaction, BankTransactions, Contact, LineItem, XeroClient } from 'xero-node';

const session = require('express-session');

const client_id: string = process.env.CLIENT_ID;
const client_secret: string = process.env.CLIENT_SECRET;
const redirectUrl: string = process.env.REDIRECT_URI;
const scopes: string = 'openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access';

interface XeroJwt {
	nbf: number
	exp: number
	iss: string,
	aud: string
	iat: number
	at_hash: string
	sid: string
	sub: string
	auth_time: number
	idp: string
	xero_userid: string
	global_session_id: string
	preferred_username: string
	email: string
	given_name: string
	family_name: string
	amr: string[]
};

interface XeroAccessToken {
	nbf: number
	exp: number
	iss: string
	aud: string
	client_id: string
	sub: string
	auth_time: number
	idp: string
	xero_userid: string
	global_session_id: string
	jti: string
	scope: string[]
	amr: string[]
};

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

const authenticationData: any = (req: Request, res: Response) => {
	return {
		decodedIdToken: req.session.decodedIdToken,
		decodedAccessToken: req.session.decodedAccessToken,
		tokenSet: req.session.tokenSet,
		allTenants: req.session.allTenants,
		activeTenant: req.session.activeTenant,
	};
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
		const url: string = `${redirectUrl}/${req.originalUrl}`;
		await xero.setAccessTokenFromRedirectUri(url);

		const tokenSet = await xero.readTokenSet();

		const decodedIdToken: XeroJwt = jwtDecode(tokenSet.id_token);
		const decodedAccessToken: XeroAccessToken = jwtDecode(tokenSet.access_token);

		req.session.decodedIdToken = decodedIdToken;
		req.session.decodedAccessToken = decodedAccessToken;
		req.session.tokenSet = tokenSet;
		req.session.allTenants = xero.tenantIds;
		req.session.activeTenant = xero.tenantIds[0];

		const authData: any = authenticationData(req, res);
		console.log(authData);

		res.redirect('/organisation');
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/organisation', async (req: Request, res: Response) => {
	try {
		const response: any = await xero.accountingApi.getOrganisations(req.session.activeTenant);
		res.send(`Hello, ${response.body.organisations[0].name}. Click to test <a href='/banktransactions'>Bank Transactions</a> <a href='/refresh-token'>Refresh Token</a>`);
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/banktransactions', async (req: Request, res: Response) => {
	try {
		const tokenSet = req.session.tokenSet;
		await xero.setTokenSet(tokenSet);

		// GET ALL
		const bankTransactionsGetResponse = await xero.accountingApi.getBankTransactions(req.session.activeTenant);

		// CREATE ONE OR MORE BANK TRANSACTION
		const contactsResponse = await xero.accountingApi.getContacts(req.session.activeTenant);
		const useContact: Contact = { contactID: contactsResponse.body.contacts[0].contactID };

		const allAccounts = await xero.accountingApi.getAccounts(req.session.activeTenant);
		const validAccountCode = allAccounts.body.accounts.filter(e => !['NONE', 'BASEXCLUDED'].includes(e.taxType))[0].code

		const lineItems: LineItem[] = [{
			description: "consulting",
			quantity: 1.0,
			unitAmount: 20.0,
			accountCode: validAccountCode,
		}];
		const where = 'Status=="' + Account.StatusEnum.ACTIVE + '" AND Type=="' + Account.BankAccountTypeEnum.BANK + '"';
		const accountsResponse = await xero.accountingApi.getAccounts(req.session.activeTenant, null, where);
		const useBankAccount: Account = { accountID: accountsResponse.body.accounts[0].accountID };

		const newBankTransaction: BankTransaction = {
			type: BankTransaction.TypeEnum.SPEND,
			contact: useContact,
			lineItems,
			bankAccount: useBankAccount,
			date: "2019-09-19T00:00:00",
		};

		// Add bank transaction objects to array
		const newBankTransactions: BankTransactions = new BankTransactions();
		newBankTransactions.bankTransactions = [newBankTransaction, newBankTransaction];
		const bankTransactionCreateResponse = await xero.accountingApi.createBankTransactions(req.session.activeTenant, newBankTransactions, false);

		// UPDATE OR CREATE ONE OR MORE BANK TRANSACTION
		const newBankTransaction2: BankTransaction = {
			type: BankTransaction.TypeEnum.SPEND,
			contact: useContact,
			lineItems,
			bankAccount: useBankAccount,
			date: "2019-09-19T00:00:00",
		};

		const newBankTransaction3: BankTransaction = {
			bankTransactionID: bankTransactionCreateResponse.body.bankTransactions[0].bankTransactionID,
			type: BankTransaction.TypeEnum.SPEND,
			contact: useContact,
			bankAccount: useBankAccount,
			reference: "Changed",
			lineItems: lineItems
		};

		const upBankTransactions: BankTransactions = new BankTransactions();
		upBankTransactions.bankTransactions = [newBankTransaction2, newBankTransaction3];
		const bankTransactionUpdateOrCreateResponse = await xero.accountingApi.updateOrCreateBankTransactions(req.session.activeTenant, upBankTransactions, false);

		// GET ONE
		const bankTransactionId = bankTransactionCreateResponse.body.bankTransactions[0].bankTransactionID;
		const bankTransactionGetResponse = await xero.accountingApi.getBankTransaction(req.session.activeTenant, bankTransactionId);

		// UPDATE status to deleted
		const bankTransactionUp = Object.assign({}, bankTransactionGetResponse.body.bankTransactions[0]);
		delete bankTransactionUp.updatedDateUTC;
		delete bankTransactionUp.contact; // also has an updatedDateUTC
		bankTransactionUp.status = BankTransaction.StatusEnum.DELETED;
		const bankTransactions: BankTransactions = { bankTransactions: [bankTransactionUp] };
		const bankTransactionUpdateResponse = await xero.accountingApi.updateBankTransaction(req.session.activeTenant, bankTransactionId, bankTransactions);

		res.json({
			authentication: authenticationData(req, res),
			getAll: bankTransactionsGetResponse.body,
			create: bankTransactionCreateResponse.body,
			getOne: bankTransactionGetResponse.body,
			update: bankTransactionUpdateResponse.body,
			updateOrCreate: bankTransactionUpdateOrCreateResponse.body
		});
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

// Xero’s access tokens have a limited lifespan of 30 minutes but they can be refreshed using a refresh token.
// This means your integration can maintain an offline connection without needing the user to re consent to your app.

// To keep the connection alive there are just a couple of points to keep in mind:

// Xero’s refresh tokens are single use meaning that you will receive a new refresh token after every refresh.
// You should replace your existing refresh token with the new one each time.
// To make the offline connection more resilient we allow used refresh tokens to be retried for a grace period of 30 minutes (after first use).
// We recommend building retry functionality into your integration in case you don’t receive the new token after a refresh.
// Unused refresh tokens expire after 60 days at which point the user will need to reauthorise your app. 
// If it’s likely that your integration will be inactive for more than sixty days you may want to set up a scheduled refresh at least every 60 days to ensure the connection stays alive.
app.get('/refresh-token', async (req: Request, res: Response) => {
	try {
		await xero.refreshToken();
		const newTokenSet = await xero.readTokenSet();

		const decodedIdToken: XeroJwt = jwtDecode(newTokenSet.id_token);
		const decodedAccessToken: XeroAccessToken = jwtDecode(newTokenSet.access_token);

		req.session.decodedIdToken = decodedIdToken;
		req.session.decodedAccessToken = decodedAccessToken;
		req.session.tokenSet = newTokenSet;
		req.session.allTenants = xero.tenantIds;
		req.session.activeTenant = xero.tenantIds[0];

		const authData: any = authenticationData(req, res);
		console.log(authData);

		res.send('Refreshed');
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});