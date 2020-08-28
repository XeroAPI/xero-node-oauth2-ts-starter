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
		<!doctype html>
			<html lang="en">
				<head>
					<!-- Required meta tags -->
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

					<!-- Bootstrap CSS -->
					<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" integrity="sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z" crossorigin="anonymous">
				</head>
				<body>
				<div style="margin: 50px;">
					<h3>Existing User? Sign In</h3>
					<form class="form-inline" action="/sign-in">
						<div class="form-group mx-3 mb-2">
							<label for="email" class="sr-only">Email:</label>
							<input type="text" class="form-control" id="email" name="email" placeholder="email@example.com">
						</div>
						<div class="form-group mx-3 mb-2">
							<label for="password" class="sr-only">Password:</label>
							<input type="password" class="form-control" id="password" name="password" placeholder="password">
						</div>
						<button type="submit" class="btn btn-primary mb-2">Submit</button>
					</form>
					<h3>New User? Sign Up</h3>
					<form class="form-inline" action="/sign-up">
						<div class="form-group mx-3 mb-2">
							<label for="fname" class="sr-only">First name:</label>
							<input type="text" class="form-control" id="fname" name="fname" placeholder="first name">
						</div>
						<div class="form-group mx-3 mb-2">
							<label for="lname" class="sr-only">Last name:</label>
							<input type="text" class="form-control" id="lname" name="lname" placeholder="last name">
						</div>
						<div class="form-group mx-3 mb-2">
							<label for="email" class="sr-only">Email:</label>
							<input type="text" class="form-control" id="email" name="email" placeholder="email@example.com">
						</div>
						<div class="form-group mx-3 mb-2">
							<label for="password" class="sr-only">Password:</label>
							<input type="password" class="form-control" id="password" name="password" placeholder="password">
						</div>
						<button type="submit" class="btn btn-primary mb-2">Submit</button>
					</form>
					<h3>Or...</h3>
					<span class="mx-3" data-xero-sso data-href="/connect" data-label="Sign in with Xero"></span>
				</div>
							<script src="https://edge.xero.com/platform/sso/xero-sso.js" async defer></script>

					<!-- Optional JavaScript -->
					<!-- jQuery first, then Popper.js, then Bootstrap JS -->
					<script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
					<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" integrity="sha384-9/reFTGAW83EW2RDu2S0VKaIzap3H66lZH81PoYlFhbGU+6BZp6G7niu735Sk7lN" crossorigin="anonymous"></script>
					<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js" integrity="sha384-B4gt1jrGC7Jh4AgTPSdUtOBvfO8shuf57BaghqFfPlYxofvL8/KUEfYiJOMMV+rV" crossorigin="anonymous"></script>
				</body>
			</html>
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
				<!doctype html>
				<html lang="en">
					<head>
						<!-- Required meta tags -->
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

						<!-- Bootstrap CSS -->
						<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" integrity="sha384-JcKb8q3iqJ61gNV9KGb8thSsNjpSL0n8PARn9HuZOnIxN0hoP+VmmDGMN5t9UJ0Z" crossorigin="anonymous">
					</head>
					<body>
						<div style="margin: 50px;">
							<div class="jumbotron">
								<h1 class="display-4">Hello, ${req.session.user.fname} ${req.session.user.lname}</h1>
								${req.session.tokenSet ?
					`<p class="lead">You're connected to Xero</p>
								<hr class="my-4">
								<p>If you want to see your Org data just click the button</p>
								<a class="btn btn-primary btn-lg" href="/organisation" role="button">See My Org Data</a>`
					:
					`<p class="lead">I see you logged in via the standard email/password option</p>
								<hr class="my-4">
								<p>To see your Xero org data you'll need to connect to Xero</p>
								<a class="btn btn-primary btn-lg" href="/connect" role="button">Connect to Xero</a>`
				}
							</div>
						</div>

						<!-- Optional JavaScript -->
						<!-- jQuery first, then Popper.js, then Bootstrap JS -->
						<script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
						<script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" integrity="sha384-9/reFTGAW83EW2RDu2S0VKaIzap3H66lZH81PoYlFhbGU+6BZp6G7niu735Sk7lN" crossorigin="anonymous"></script>
						<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js" integrity="sha384-B4gt1jrGC7Jh4AgTPSdUtOBvfO8shuf57BaghqFfPlYxofvL8/KUEfYiJOMMV+rV" crossorigin="anonymous"></script>
					</body>
				</html>
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