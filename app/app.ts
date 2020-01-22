require('dotenv').config();
import express from 'express';
import { Request, Response } from 'express';
import jwtDecode from 'jwt-decode';
import { XeroClient } from 'xero-node';

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
		accessToken: req.session.accessToken,
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

		const accessToken = await xero.readTokenSet();

		const decodedIdToken: XeroJwt = jwtDecode(accessToken.id_token);
		const decodedAccessToken: XeroAccessToken = jwtDecode(accessToken.access_token);

		req.session.decodedIdToken = decodedIdToken;
		req.session.decodedAccessToken = decodedAccessToken;
		req.session.accessToken = accessToken;
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
		res.send(`Hello, ${response.body.organisations[0].name}`);
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});