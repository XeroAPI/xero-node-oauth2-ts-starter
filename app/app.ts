require('dotenv').config();
import express from 'express';
import { Request, Response } from 'express';
import jwtDecode from 'jwt-decode';
import { TokenSet } from 'openid-client';
import { XeroAccessToken, XeroIdToken, XeroClient } from 'xero-node';

const session = require('express-session');
const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync('db.json');
const db = lowdb(adapter);

db.setState({});
db.defaults({ users: [{ fname: 'Joe', lname: 'Exotic', email: 'thetigerking@hotmail.com', password: 'c@r0leb@$kin' }] }).write();

const client_id: string = process.env.CLIENT_ID;
const client_secret: string = process.env.CLIENT_SECRET;
const redirectUrl: string = process.env.REDIRECT_URI;
const scopes: string = 'openid profile email accounting.settings offline_access';

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
	if (req.session.isLoggedIn && req.session.user) {
		res.redirect('/home')
	} else {
		res.send(`
			<h3>Existing User? Sign In</h3>
			<form action="/sign-in">
				<label for="email">Email:</label>
				<input type="text" id="email" name="email"><br><br>
				<label for="password">Password:</label>
				<input type="password" id="password" name="password"><br><br>
				<input type="submit" value="Submit">
			</form>
			<h3>New User? Sign Up</h3>
			<form action="/sign-up">
				<label for="fname">First name:</label>
				<input type="text" id="fname" name="fname"><br><br>
				<label for="lname">Last name:</label>
				<input type="text" id="lname" name="lname"><br><br>
				<label for="email">Email:</label>
				<input type="text" id="email" name="email"><br><br>
				<label for="password">Password:</label>
				<input type="password" id="password" name="password"><br><br>
				<input type="submit" value="Submit">
			</form>
			<h3>Or...</h3>
			<a href='/connect'>Sign In with Xero</a>
		`);
	}
});

app.get('/sign-in', async (req: Request, res: Response) => {
	try {
		const user = db.get('users').filter({ email: req.query.email }).value()[0]
		if (user && user.password === req.query.password) {
			req.session.isLoggedIn = true;
			req.session.user = user;
			res.redirect('/home');
		} else {
			res.send('Credentials no good');
		};
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/sign-up', async (req: Request, res: Response) => {
	try {
		const user = { fname: req.query.fname, lname: req.query.lname, email: req.query.email, password: req.query.password };
		if (db.get('users').filter({ email: req.query.email }).value().length === 0) {
			db.get('users').push(user).write();
			req.session.isLoggedIn = true;
			req.session.user = user;
			res.redirect('/home');
		} else {
			res.send('Account under that email already exists');
		};
		console.log(db.get('users').value());
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
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

		if (db.get('users').filter({ email: decodedIdToken.email }).value().length === 0) {
			const user = { fname: decodedIdToken.given_name, lname: decodedIdToken.family_name, email: decodedIdToken.email, tokenSet };
			db.get('users').push(user).write();
			req.session.isLoggedIn = true;
			req.session.user = user;
		} else {
			db.get('users').find({ email: decodedIdToken.email }).assign({ tokenSet }).write();
			const user = db.get('users').find({ email: decodedIdToken.email });
			req.session.isLoggedIn = true;
			req.session.user = user;
		}

		res.redirect('/home');
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/home', async (req: Request, res: Response) => {
	try {
		if (req.session.isLoggedIn && req.session.user) {
			res.send(`
			Hello, ${req.session.user.fname} ${req.session.user.lname}
			${req.session.tokenSet ? "<a href='/organisation'>Get Xero Org</a>" : "<a href='/connect'>Connect to Xero</a>"}
			`);
		} else {
			res.redirect('/');
		}
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

app.get('/organisation', async (req: Request, res: Response) => {
	try {
		if (req.session.activeTenant) {
			const response: any = await xero.accountingApi.getOrganisations(req.session.activeTenant.tenantId);
			res.send(`Hello, ${response.body.organisations[0].name}`);
		} else {
			res.send(`You need to connect to Xero first <a href='/connect'>Connect to Xero</a`)
		}
	} catch (err) {
		res.send('Sorry, something went wrong');
	}
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});