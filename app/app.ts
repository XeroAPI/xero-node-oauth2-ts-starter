require('dotenv').config();
import express from 'express';
import { Request, Response } from 'express';
import jwtDecode from 'jwt-decode';
import { XeroClient, Account, AccountType, Allocation, HistoryRecords, BankTransaction, BankTransactions, BankTransfers, BatchPayments, Invoice, Invoices, PaymentService, Contacts, ContactGroups, Phone, PaymentTermType, Allocations, CreditNote, CreditNotes, Currency, CurrencyCode, Employee, Employees, ExpenseClaim, ExpenseClaims, Items, LinkedTransaction, ManualJournal, ManualJournals, Payment, Payments, PaymentServices, PurchaseOrders, Quotes, Receipt, Receipts, LineAmountTypes, TaxRates, TaxRate, TrackingCategory, TrackingOption, RequestEmpty, BankTransfer, BatchPayment, ContactGroup, Contact, Item, Overpayment, Prepayment, RepeatingInvoice, User } from 'xero-node';
import * as fs from "fs";
import { TokenSet } from 'openid-client';

const session = require('express-session');

const client_id: string = process.env.CLIENT_ID;
const client_secret: string = process.env.CLIENT_SECRET;
const redirectUrl: string = process.env.REDIRECT_URI;
const scopes: string = 'openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access paymentservices';

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
	// try {
	// 	const response: any = await xero.accountingApi.getOrganisations(req.session.activeTenant);
	// 	res.send(`Hello, ${response.body.organisations[0].name}`);
	// } catch (err) {
	// 	res.send('Sorry, something went wrong');
	// }


	const xeroTenantId = '923e41ab-3dce-4b6e-8e8c-49e1d7e19df7';  // {String} Xero identifier for Tenant 
	await xero.setTokenSet(new TokenSet({
		id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE1ODA5NDY3NDQsImV4cCI6MTU4MDk0NzA0NCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6IjlGREY1OUVDNkJDODQ0OTNBRjI5QUFCNkNDNDREMzM1IiwiaWF0IjoxNTgwOTQ2NzQ0LCJhdF9oYXNoIjoiMWF3ZEw0MlhPNU42aVE1VXFUSDhYdyIsInNpZCI6IjUzYzhmZGNjODEyNDI1NWVmZDRhNDg2NGM2NmM4MjA4Iiwic3ViIjoiZjFjNGQ0YjY3NDI0NTI4NmFjYmZkODBjOTExMTg0OWUiLCJhdXRoX3RpbWUiOjE1ODA5NDY3MzQsInhlcm9fdXNlcmlkIjoiOTY1MzY1MDAtNDViOS00MTcwLWI0YWQtNDBjMTgwZmI5ZjQ4IiwiZ2xvYmFsX3Nlc3Npb25faWQiOiJhNDY1MTA0YmVmNWU0ZjcxYWUyODI0OTM4MzAyYTFhZiIsInByZWZlcnJlZF91c2VybmFtZSI6InJldHQuYmVocmVuc0B4ZXJvLmNvbSIsImVtYWlsIjoicmV0dC5iZWhyZW5zQHhlcm8uY29tIiwiZ2l2ZW5fbmFtZSI6IlJldHQiLCJmYW1pbHlfbmFtZSI6IkJlaHJlbnMifQ.mSR70wI3uiUO81HBhNMl5HGk1j4yZpqlF-7MRVCfd3X9vh9HaAEx39aQjlkEc3ROCvekR_Kou0a8WPPImBzv2ymAOHl8mXo_LRgsSpg2V74JNPdCF7wNiS92uAP0tniWVmHNKwKZ3LisS0QIwuMbppE1rx5EejBsRxZQTSLRubWLC-r99ItEy91-ik8wmdPPfwDmUkR_CMhbPTiRFyk_G5AXgKyAjyvJOfqcA3_FxEewq3HORU8yflJurWtLaJihcSLhzn29ppeWd_77w4Tb7DZtCnBp95VjYh40n45n5KhzrEZT8UfHd3mnAmohrHJ0e0icVTouDOvXv3RHhi_MwA',
		access_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY09fQmsifQ.eyJuYmYiOjE1ODA5NDY3NDQsImV4cCI6MTU4MDk0ODU0NCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiOUZERjU5RUM2QkM4NDQ5M0FGMjlBQUI2Q0M0NEQzMzUiLCJzdWIiOiJmMWM0ZDRiNjc0MjQ1Mjg2YWNiZmQ4MGM5MTExODQ5ZSIsImF1dGhfdGltZSI6MTU4MDk0NjczNCwieGVyb191c2VyaWQiOiI5NjUzNjUwMC00NWI5LTQxNzAtYjRhZC00MGMxODBmYjlmNDgiLCJnbG9iYWxfc2Vzc2lvbl9pZCI6ImE0NjUxMDRiZWY1ZTRmNzFhZTI4MjQ5MzgzMDJhMWFmIiwianRpIjoiNzJiMTAxNzk4NDRjMTkxMDg0OTFjMDE1OGFmNTZkMmYiLCJzY29wZSI6WyJlbWFpbCIsInByb2ZpbGUiLCJvcGVuaWQiLCJhY2NvdW50aW5nLnJlcG9ydHMucmVhZCIsInBheW1lbnRzZXJ2aWNlcyIsImFjY291bnRpbmcuc2V0dGluZ3MiLCJhY2NvdW50aW5nLmF0dGFjaG1lbnRzIiwiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLmpvdXJuYWxzLnJlYWQiLCJhY2NvdW50aW5nLmNvbnRhY3RzIiwib2ZmbGluZV9hY2Nlc3MiXX0.g_h2uGGwQRCY9ewGhd569nrxUb7zur-PGUhvdNxQrSWiTmnhw4oxDxjvpkJaoIPRoyNs5B5vPG9qu_qSmB7wuBbNHvDpF3-JEssmI4Ef0IcfOEZM5Lol-Ln4OkIvN0vkZSIxrK5m69XI4UmR6kAyiJORpRAECiwoksJKMthGsEq0ZquDzRtI7KLdaiO0mn9QmapSw81AMAgO3o2wDhR2yCOQKByYW3iW6kE9ueWhNZ455hMIMd7HZEv60XYBOSWu1irOmjCXyCFfWKtSkIMp-YiFTCbX4zFNPudXN5jKYQyI-n-jRWwqdLPuHGv82jBySa6Zv7u_JwjpFArsy2YS1w',
		expires_at: 1580948544,
		token_type: 'Bearer',
		refresh_token: '29b74a7654e1ae7c4fe48d075040252bc1d0bd240f1cab86df7cf96e49f76925',
		session_state: '_gCQjDN5HuIDBwSaL1_oB8orzbi8wblhxa4g2vSEBrA.806bc9da80c25ece935173cf0373e60a'
	}));

	// CREATE ACCOUNT
	// const account: Account = { code: "123458", name: "Foobar3", type: AccountType.EXPENSE, description: "Hello World" };  // {Account} 
	// try {
	// 	const response: any = await xero.accountingApi.createAccount(xeroTenantId, account);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createAccountAttachmentByFileName
	// 	const accountID = "ceef66a5-a545-413b-9312-78a53caadbc4";  // {UUID} Unique identifier for Account object 
	// 	const fileName = "xero-dev.jpg";  // {String} Name of the attachment 
	// 	const path = require("path");
	// 	const mime = require("mime-types");
	// 	const pathToUpload = path.resolve(__dirname, "../public/images/xero-dev.jpg"); // determine the path to your file

	// 	// You'll need to add the import below to read your file
	// 	// import * as fs from "fs";
	// 	const body = fs.createReadStream(pathToUpload); // {fs.ReadStream} read the file
	// 	const contentType = mime.lookup(fileName);
	// 	try {
	// 		const response: any = await xero.accountingApi.createAccountAttachmentByFileName(xeroTenantId, accountID, fileName, body, {
	// 			headers: {
	// 				"Content-Type": contentType,
	// 			}
	// 		});
	// 		console.log(response.body);
	// 		res.send('Hello');
	// 	} catch (err) {
	// 		console.log(err);
	// 		console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 		console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// 	}
	// });

	// createBankTransactionHistoryRecord
	// const bankTransactionID = "9575e6f9-fead-4456-bfba-aefed46937f2";  // {UUID} Xero generated unique identifier for a bank transaction 
	// const historyRecords: HistoryRecords = { historyRecords: [{ details: "Hello World" }] };  // {HistoryRecords} 
	// try {
	// 	const response: any = await xero.accountingApi.createBankTransactionHistoryRecord(xeroTenantId, bankTransactionID, historyRecords);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createBankTransactions
	// const bankTransactions: BankTransactions = { bankTransactions: [{ type: BankTransaction.TypeEnum.SPEND, contact: { contactID: "c313aeb9-6fd1-4ead-9e0a-4b7e8bff0d1a" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "400" }], bankAccount: { code: "090" } }] };  // {BankTransactions} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createBankTransactions(xeroTenantId, bankTransactions, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createbanktransfer
	// const bankTransfers: BankTransfers = { bankTransfers: [{ fromBankAccount: { code: "090", accountID: "ceef66a5-a545-413b-9312-78a53caadbc4" }, toBankAccount: { code: "091", accountID: "3d09fd49-434d-4c18-a57b-831663ab70d2" }, amount: "50.00" }] };  // {BankTransfers} 
	// try {
	// 	const response: any = await xero.accountingApi.createBankTransfer(xeroTenantId, bankTransfers);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createbatchpayments
	// const batchPayments: BatchPayments = { batchPayments: [{ account: { accountID: "3d09fd49-434d-4c18-a57b-831663ab70d2" }, reference: "ref", date: "2018-08-01", payments: [{ account: { code: "001" }, date: "2019-12-31", amount: 500, invoice: { invoiceID: "20ff01b8-c2d8-49bb-8abf-a9486c9ea665", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY } }] }] };  // {BatchPayments} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createBatchPayment(xeroTenantId, batchPayments, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createBrandingThemePaymentServices
	// const brandingThemeID = "324587a9-7eed-46c0-ad64-fa941a1b5b3e";  // {UUID} Unique identifier for a Branding Theme 
	// const paymentService: PaymentService = { paymentServiceID: "dede7858-14e3-4a46-bf95-4d4cc491e645", paymentServiceName: "ACME Payments", paymentServiceUrl: "https://www.payupnow.com/", payNowText: "Pay Now" };  // {PaymentService} 
	// try {
	// 	const response: any = await xero.accountingApi.createBrandingThemePaymentServices(xeroTenantId, brandingThemeID, paymentService);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(JSON.stringify(err));
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(err.response.body.Elements ? `Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}` : err.response.body.detail);
	// }

	// createcontactgroup
	// const contactGroups: ContactGroups = { contactGroups: [{ name: "Suppliers - custom name" }] };  // {ContactGroups} 
	// try {
	// 	const response: any = await xero.accountingApi.createContactGroup(xeroTenantId, contactGroups);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createcontactgroupcontacts
	// const contactGroupID = "6d1264c5-8dee-4d19-9bb9-1f1e0e4f9ba0";  // {UUID} Unique identifier for a Contact Group 
	// const contacts: Contacts = { contacts: [{ contactID: "c313aeb9-6fd1-4ead-9e0a-4b7e8bff0d1a" }, { contactID: "f817d079-80ba-4a4f-8b57-6171c0cdd14c" }] };  // {Contacts} 
	// try {
	// 	const response: any = await xero.accountingApi.createContactGroupContacts(xeroTenantId, contactGroupID, contacts);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(err);
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createcontacts
	// const contacts: Contacts = { contacts: [{ name: "Bruce Banner", emailAddress: "hulk@avengers.com", phones: [{ phoneType: Phone.PhoneTypeEnum.MOBILE, phoneNumber: "555-1212", phoneAreaCode: "415" }], paymentTerms: { bills: { day: 15, type: PaymentTermType.OFCURRENTMONTH }, sales: { day: 10, type: PaymentTermType.DAYSAFTERBILLMONTH } } }] };  // {Contacts} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createContacts(xeroTenantId, contacts, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createcreditnoteallocation
	// const creditNoteID = "4f12681f-be5c-4762-a128-2c9bf439dcc6";  // {UUID} Unique identifier for a Credit Note 
	// const allocations: Allocations = { allocations: [{ amount: 1.0, date: "2019-03-05", invoice: { invoiceID: "20ff01b8-c2d8-49bb-8abf-a9486c9ea665", lineItems: [], type: Invoice.TypeEnum.ACCPAY, contact: {} } }] };  // {Allocations} 
	// try {
	// 	const response: any = await xero.accountingApi.createCreditNoteAllocation(xeroTenantId, creditNoteID, allocations);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createCreditNotes
	// const creditNotes: CreditNotes = { creditNotes: [{ type: CreditNote.TypeEnum.ACCPAYCREDIT, contact: { contactID: "54999de9-4690-4195-99bc-646970b23fb1" }, date: "2019-01-05", lineItems: [{ description: "Foobar", quantity: 2.0, unitAmount: 20.0, accountCode: "400" }] }] };  // {CreditNotes} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createCreditNotes(xeroTenantId, creditNotes, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createcurrency
	// const currency: Currency = { code: CurrencyCode.USD, description: "United States Dollar" };  // {Currency} 
	// try {
	// 	const response: any = await xero.accountingApi.createCurrency(xeroTenantId, currency);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createemployee
	// const employee: Employee = { firstName: "Nick", lastName: "Fury", externalLink: { url: "http://twitter.com/#!/search/Nick+Fury" } };  // {Employee} 
	// try {
	// 	const response: any = await xero.accountingApi.createEmployee(xeroTenantId, employee);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createemployees
	// const employees: Employees = { employees: [{ firstName: "Black", lastName: "Widow", externalLink: { url: "http://twitter.com/#!/search/Black+Widow" } }] };  // {Employees} 
	// try {
	// 	const response: any = await xero.accountingApi.createEmployees(xeroTenantId, employees);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createexpenseclaims
	// const expenseClaims: ExpenseClaims = { expenseClaims: [{ status: ExpenseClaim.StatusEnum.SUBMITTED, user: { userID: "d6362594-ffec-4435-abe8-469941ff1501" }, receipts: [{ receiptID: "c4f40e59-c390-0001-caff-ce731c707d00", lineItems: [], contact: {}, user: {}, date: "2018-01-01" }] }] };  // {ExpenseClaims} 
	// try {
	// 	const response: any = await xero.accountingApi.createExpenseClaims(xeroTenantId, expenseClaims);
	// 	console.log(response.body);
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createinvoices
	// const invoices: Invoices = { invoices: [{ type: Invoice.TypeEnum.ACCREC, contact: { contactID: "c313aeb9-6fd1-4ead-9e0a-4b7e8bff0d1a" }, lineItems: [{ description: "Acme Tires", quantity: 2.0, unitAmount: 20.0, accountCode: "500", taxType: "NONE", lineAmount: 40.0 }], date: "2019-03-11", dueDate: "2018-12-10", reference: "Website Design", status: Invoice.StatusEnum.AUTHORISED }] };  // {Invoices} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createInvoices(xeroTenantId, invoices, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createitems
	// const items: Items = { items: [{ code: "abcXYZ123", name: "HelloWorld11", description: "Foobar", inventoryAssetAccountCode: "140", purchaseDetails: { cOGSAccountCode: "500" } }] };  // {Items} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createItems(xeroTenantId, items, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createlinkedtransaction
	// const linkedTransaction: LinkedTransaction = { sourceTransactionID: "9575e6f9-fead-4456-bfba-aefed46937f2", sourceLineItemID: "724cae02-3fe4-4f14-ab92-73c2f9b54e8b" };  // {LinkedTransaction} 
	// try {
	// 	const response: any = await xero.accountingApi.createLinkedTransaction(xeroTenantId, linkedTransaction);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createmanualjournal
	// const manualJournal: ManualJournal = { narration: "Foo bar", journalLines: [{ lineAmount: 100.0, accountCode: "400", description: "Hello there" }, { lineAmount: -100.0, accountCode: "400", description: "Goodbye", tracking: [{ name: "Simpsons", option: "Bart" }] }], date: "2019-03-14" };  // {ManualJournal} 
	// try {
	// 	const response: any = await xero.accountingApi.createManualJournal(xeroTenantId, manualJournal);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createmanualjournals
	// const manualJournals: ManualJournals = { manualJournals: [{ narration: "Foo bar", journalLines: [{ lineAmount: 100.0, accountCode: "400", description: "Hello there" }, { lineAmount: -100.0, accountCode: "400", description: "Goodbye", tracking: [{ name: "Simpsons", option: "Bart" }] }], date: "2019-03-14" }] };  // {ManualJournals} 
	// try {
	// 	const response: any = await xero.accountingApi.createManualJournals(xeroTenantId, manualJournals);
	// 	console.log(response.body);
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createoverpaymentallocation
	// const overpaymentID = "7b26512e-e535-45bd-94f1-90b71025ad12";  // {UUID} Unique identifier for a Overpayment 
	// const allocation: Allocation = { invoice: { invoiceID: "9eb7b996-4ac6-4cf8-8ee8-eb30d6e572e3", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }, amount: 1.0, date: "2019-03-12" };  // {Allocation} 
	// try {
	// 	const response: any = await xero.accountingApi.createOverpaymentAllocation(xeroTenantId, overpaymentID, allocation);
	// 	console.log(response.body);
	// 	res.send('Hello');
	// } catch (err) {
	// 	console.log(JSON.stringify(err.response));
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createpayment
	// const payment: Payment = { invoice: { invoiceID: "a8808530-a51e-4930-8c71-5d6d18885edd", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }, account: { code: "090" }, date: "2019-03-12", amount: 1.0 };  // {Payment} 
	// try {
	// 	const response: any = await xero.accountingApi.createPayment(xeroTenantId, payment);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createpaymentservice
	// const paymentServices: PaymentServices = { paymentServices: [{ paymentServiceName: "PayUpNow", paymentServiceUrl: "https://www.payupnow.com/", payNowText: "Time To Pay" }] };  // {PaymentServices} 
	// try {
	// 	const response: any = await xero.accountingApi.createPaymentService(xeroTenantId, paymentServices);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createpayments
	// const payments: Payments = { payments: [{ invoice: { invoiceID: "a8808530-a51e-4930-8c71-5d6d18885edd", lineItems: [], contact: {}, type: Invoice.TypeEnum.ACCPAY }, account: { code: "090" }, date: "2019-03-12", amount: 1.0 }] };  // {Payments} 
	// try {
	// 	const response: any = await xero.accountingApi.createPayments(xeroTenantId, payments);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createprepaymentallocation
	// const prepaymentID = "9f6ee877-e579-44af-8df4-8ffe83c423b4";  // {UUID} Unique identifier for Prepayment 
	// const allocations: Allocations = { allocations: [{ invoice: { invoiceID: "a8808530-a51e-4930-8c71-5d6d18885edd", lineItems: [], contact: {}, type: null }, amount: 1.0, date: "2019-03-13" }] };  // {Allocations} 
	// try {
	// 	const response: any = await xero.accountingApi.createPrepaymentAllocation(xeroTenantId, prepaymentID, allocations);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createpurchaseorders
	// const purchaseOrders: PurchaseOrders = { purchaseOrders: [{ contact: { contactID: "54999de9-4690-4195-99bc-646970b23fb1" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "710" }], date: "2019-03-13" }] };  // {PurchaseOrders} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createPurchaseOrders(xeroTenantId, purchaseOrders, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createquotes
	// const quotes: Quotes = { quotes: [{ contact: { contactID: "54999de9-4690-4195-99bc-646970b23fb1" }, lineItems: [{ description: "Foobar", quantity: 1.0, unitAmount: 20.0, accountCode: "12775" }], date: "2020-02-01" }] };  // {Quotes} 
	// const summarizeErrors = true;  // {Boolean} If false return 200 OK and mix of successfully created obejcts and any with validation errors

	// try {
	// 	const response: any = await xero.accountingApi.createQuotes(xeroTenantId, quotes, summarizeErrors);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createreceipt
	// const receipts: Receipts = { receipts: [{ contact: { contactID: "54999de9-4690-4195-99bc-646970b23fb1" }, lineItems: [{ description: "Foobar", quantity: 2.0, unitAmount: 20.0, accountCode: "400", taxType: "NONE", lineAmount: 40.0 }], user: { userID: "d6362594-ffec-4435-abe8-469941ff1501" }, lineAmountTypes: LineAmountTypes.Inclusive, status: Receipt.StatusEnum.DRAFT, date: null }] };  // {Receipts} 
	// try {
	// 	const response: any = await xero.accountingApi.createReceipt(xeroTenantId, receipts);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createtaxrates
	// const taxRates: TaxRates = { taxRates: [{ name: "CA State Tax", taxComponents: [{ name: "State Tax", rate: 2.25 }], reportTaxType: undefined }] };  // {TaxRates} 
	// try {
	// 	const response: any = await xero.accountingApi.createTaxRates(xeroTenantId, taxRates);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createtrackingcategory
	// const trackingCategory: TrackingCategory = { name: "FooBar" };  // {TrackingCategory} 
	// try {
	// 	const response: any = await xero.accountingApi.createTrackingCategory(xeroTenantId, trackingCategory);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// createtrackingoptions
	// const trackingCategoryID = "3f5f3182-1709-429d-9671-31ed15ff740b";  // {UUID} Unique identifier for a TrackingCategory 
	// const trackingOption: TrackingOption = { name: "Bar" };  // {TrackingOption} 
	// try {
	// 	const response: any = await xero.accountingApi.createTrackingOptions(xeroTenantId, trackingCategoryID, trackingOption);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deleteaccount
	// const accountID = "c3c73f17-4aa1-428a-a69b-d8ca977c7e10";  // {UUID} Unique identifier for retrieving single object
	// try {
	// 	const response: any = await xero.accountingApi.deleteAccount(xeroTenantId, accountID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deletecontactgroupcontact
	// const contactGroupID = "1b979d15-4ad9-42d7-8111-85b990477df0";  // {UUID} Unique identifier for a Contact Group 
	// const contactID = "375ac066-85a0-4044-a8be-3159856d5c85";  // {UUID} Unique identifier for a Contact
	// try {
	// 	const response: any = await xero.accountingApi.deleteContactGroupContact(xeroTenantId, contactGroupID, contactID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deletecontactgroupcontacts
	// const contactGroupID = "1b979d15-4ad9-42d7-8111-85b990477df0";  // {UUID} Unique identifier for a Contact Group
	// try {
	// 	const response: any = await xero.accountingApi.deleteContactGroupContacts(xeroTenantId, contactGroupID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deleteitem
	// const itemID = "3c8ea74d-950e-4ff1-b5bb-4e53045e9ac4";  // {UUID} Unique identifier for an Item
	// try {
	// 	const response: any = await xero.accountingApi.deleteItem(xeroTenantId, itemID);
	// 	console.log(response.body || response.response.statusCode);
	// 	res.json(response);
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deletelinkedtransaction
	// const linkedTransactionID = "80894793-9eee-40e9-976f-4cfeae03404c";  // {UUID} Unique identifier for a LinkedTransaction
	// try {
	// 	const response: any = await xero.accountingApi.deleteLinkedTransaction(xeroTenantId, linkedTransactionID);
	// 	console.log(response.body || response.response.statusCode);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deletepayment
	// const paymentID = "da23ec2a-b32c-46ce-998f-9fbe924ef30e";  // {UUID} Unique identifier for a Payment 
	// const payments: Payments = { payments: [{ status: Payment.StatusEnum.DELETED }] };  // {Payments} 
	// try {
	// 	const response: any = await xero.accountingApi.deletePayment(xeroTenantId, paymentID, payments);
	// 	console.log(response.body || response.response.statusCode);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deletetrackigcategory
	// const trackingCategoryID = "5825ab48-5c8b-4953-9c63-a7a131aa3fe2";  // {UUID} Unique identifier for a TrackingCategory
	// try {
	// 	const response: any = await xero.accountingApi.deleteTrackingCategory(xeroTenantId, trackingCategoryID);
	// 	console.log(response.body || response.response.statusCode);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// deletetrackingoptions
	// const trackingCategoryID = "3f5f3182-1709-429d-9671-31ed15ff740b";  // {UUID} Unique identifier for a TrackingCategory 
	// const trackingOptionID = "ee69fc80-fd87-4706-abc2-9e952a6191b0";  // {UUID} Unique identifier for a Tracking Option
	// try {
	// 	const response: any = await xero.accountingApi.deleteTrackingOptions(xeroTenantId, trackingCategoryID, trackingOptionID);
	// 	console.log(response.body || response.response.statusCode);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// emailinvoice
	// const invoiceID = "f780c6bc-9fc8-406c-ace6-d5c9d6246514";  // {UUID} Unique identifier for an Invoice 
	// const requestEmpty: RequestEmpty = {};  // {RequestEmpty} 
	// try {
	// 	const response: any = await xero.accountingApi.emailInvoice(xeroTenantId, invoiceID, requestEmpty);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(JSON.stringify(err));
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getaccount
	// const accountID = "ceef66a5-a545-413b-9312-78a53caadbc4";  // {UUID} Unique identifier for retrieving single object
	// try {
	// 	const response: any = await xero.accountingApi.getAccount(xeroTenantId, accountID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getaccountattachmentbyfilename
	// const accountID = "ceef66a5-a545-413b-9312-78a53caadbc4";  // {UUID} Unique identifier for Account object 
	// const fileName = "xero-dev.jpg";  // {String} Name of the attachment 
	// const contentType = "image/jpg";  // {String} The mime type of the attachment file you are retrieving i.e image/jpg, application/pdf
	// try {
	// 	const response: any = await xero.accountingApi.getAccountAttachmentByFileName(xeroTenantId, accountID, fileName, contentType);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getaccounts
	// const ifModifiedSince = undefined;
	// const where = `Status=="${Account.StatusEnum.ACTIVE}" AND Type=="${Account.BankAccountTypeEnum.BANK}"`;
	// const order = "Code";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getAccounts(xeroTenantId, ifModifiedSince, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbanktransaction
	// const bankTransactionID = "6e3f44aa-4122-451e-9767-2882f396489f";  // {UUID} Xero generated unique identifier for a bank transaction
	// try {
	// 	const response: any = await xero.accountingApi.getBankTransaction(xeroTenantId, bankTransactionID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbanktransactions
	// const ifModifiedSince = undefined;
	// const where = `Status=="${BankTransaction.StatusEnum.AUTHORISED}"`
	// const order = "DATE";  // {String} Order by an any element
	// const page = 1;  // {Integer} Up to 100 bank transactions will be returned in a single API call with line items details
	// const unitdp = 4;  // {Integer} e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts

	// try {
	// 	const response: any = await xero.accountingApi.getBankTransactions(xeroTenantId, ifModifiedSince, where, order, page, unitdp);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbanktransfer
	// const bankTransferID = "19a8c722-b61d-4cda-ab76-e3cb551cb538";  // {UUID} Xero generated unique identifier for a bank transfer
	// try {
	// 	const response: any = await xero.accountingApi.getBankTransfer(xeroTenantId, bankTransferID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbanktransfers
	// const ifModifiedSince = undefined;
	// const where = 'Amount==50.00';
	// const order = "Date";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getBankTransfers(xeroTenantId, ifModifiedSince, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbatchpayments
	// const ifModifiedSince = undefined
	// const where = `Status=="AUTHORISED"`;
	// const order = "Type";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getBatchPayments(xeroTenantId, ifModifiedSince, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbrandingtheme
	// const brandingThemeID = "324587a9-7eed-46c0-ad64-fa941a1b5b3e";  // {UUID} Unique identifier for a Branding Theme
	// try {
	// 	const response: any = await xero.accountingApi.getBrandingTheme(xeroTenantId, brandingThemeID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbrandingthemepaymentservices
	// const brandingThemeID = "324587a9-7eed-46c0-ad64-fa941a1b5b3e";  // {UUID} Unique identifier for a Branding Theme
	// try {
	// 	const response: any = await xero.accountingApi.getBrandingThemePaymentServices(xeroTenantId, brandingThemeID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getbrandingtheme
	// try {
	// 	const response: any = await xero.accountingApi.getBrandingThemes(xeroTenantId);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcontact
	// const contactID = "54999de9-4690-4195-99bc-646970b23fb1";  // {UUID} Unique identifier for a Contact
	// try {
	// 	const response: any = await xero.accountingApi.getContact(xeroTenantId, contactID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcontactcissettings
	// const contactID = "54999de9-4690-4195-99bc-646970b23fb1";  // {UUID} Unique identifier for a Contact
	// try {
	// 	const response: any = await xero.accountingApi.getContactCISSettings(xeroTenantId, contactID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcontactgroup
	// const contactGroupID = "6d1264c5-8dee-4d19-9bb9-1f1e0e4f9ba0";  // {UUID} Unique identifier for a Contact Group
	// try {
	// 	const response: any = await xero.accountingApi.getContactGroup(xeroTenantId, contactGroupID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcontactgroups
	// const where = `Status=="${ContactGroup.StatusEnum.ACTIVE}"`;
	// const order = "Name";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getContactGroups(xeroTenantId, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcontacts
	// const ifModifiedSince = undefined;
	// const where = `Status=="${Contact.ContactStatusEnum.ACTIVE}"`;  // {String} Filter by an any element
	// const order = "Name";  // {String} Order by an any element
	// const iDs = ['54999DE9-4690-4195-99BC-646970B23FB1', 'b47b7750-4d86-447b-92ad-6fbefcf888b6'];
	// const page = 1;  // {Integer} e.g. page=1 - Up to 100 contacts will be returned in a single API call.
	// const includeArchived = true;  // {Boolean} e.g. includeArchived=true - Contacts with a status of ARCHIVED will be included in the response

	// try {
	// 	const response: any = await xero.accountingApi.getContacts(xeroTenantId, ifModifiedSince, where, order, iDs, page, includeArchived);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcreditnote
	// const creditNoteID = "4f12681f-be5c-4762-a128-2c9bf439dcc6";  // {UUID} Unique identifier for a Credit Note
	// try {
	// 	const response: any = await xero.accountingApi.getCreditNote(xeroTenantId, creditNoteID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcreditnotes
	// const ifModifiedSince = undefined;
	// const where = `Status=="${CreditNote.StatusEnum.PAID}"`;
	// const order = "Date";  // {String} Order by an any element
	// const page = 1;  // {Integer} e.g. page=1 – Up to 100 credit notes will be returned in a single API call with line items shown for each credit note

	// try {
	// 	const response: any = await xero.accountingApi.getCreditNotes(xeroTenantId, ifModifiedSince, where, order, page);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getcurrencies
	// const where = `Code.Contains("U")`;  // {String} Filter by an any element
	// const order = "Code";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getCurrencies(xeroTenantId, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getemployee
	// const employeeID = "54021264-9ebc-4702-8456-2c358d633168";  // {UUID} Unique identifier for a Employee
	// try {
	// 	const response: any = await xero.accountingApi.getEmployee(xeroTenantId, employeeID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getemployees
	// const ifModifiedSince = undefined;
	// const where = `Status=="${Employee.StatusEnum.ACTIVE}"`;  // {String} Filter by an any element
	// const order = "FirstName";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getEmployees(xeroTenantId, ifModifiedSince, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getexpenseclaim
	// const expenseClaimID = "0b44a210-b9eb-447a-8c7b-fe5e7e40f25c";  // {UUID} Unique identifier for a ExpenseClaim
	// try {
	// 	const response: any = await xero.accountingApi.getExpenseClaim(xeroTenantId, expenseClaimID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getexpenseclaims
	// const ifModifiedSince = undefined;
	// const where = `Status=="${ExpenseClaim.StatusEnum.PAID}"`;  // {String} Filter by an any element
	// const order = "Total";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getExpenseClaims(xeroTenantId, ifModifiedSince, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getinvoice
	// const invoiceID = "20ff01b8-c2d8-49bb-8abf-a9486c9ea665";  // {UUID} Unique identifier for an Invoice
	// try {
	// 	const response: any = await xero.accountingApi.getInvoice(xeroTenantId, invoiceID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getinvoicereminders
	// try {
	// 	const response: any = await xero.accountingApi.getInvoiceReminders(xeroTenantId);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getinvoices
	// const ifModifiedSince = null;
	// const where = `Status=="${Invoice.StatusEnum.PAID}"`;  // {String} Filter by an any element
	// const order = "Total";  // {String} Order by an any element
	// const iDs = ['20ff01b8-c2d8-49bb-8abf-a9486c9ea665', '3047f972-b6d9-485d-adbc-adcb3a8ebeb4'];  // {array[UUID]} Filter by a comma-separated list of InvoicesIDs.
	// const invoiceNumbers = null;  // {array[String]} Filter by a comma-separated list of InvoiceNumbers.
	// const contactIDs = ['181edd84-d098-4468-95cd-e3ac74bc22c5'];  // {array[UUID]} Filter by a comma-separated list of ContactIDs.
	// const statuses = null;  // {array[String]} Filter by a comma-separated list Statuses. For faster response times we recommend using these explicit parameters instead of passing OR conditions into the Where filter.
	// const page = 1;  // {Integer} e.g. page=1 – Up to 100 invoices will be returned in a single API call with line items shown for each invoice
	// const includeArchived = true;  // {Boolean} e.g. includeArchived=true - Contacts with a status of ARCHIVED will be included in the response
	// const createdByMyApp = false;  // {Boolean} When set to true you'll only retrieve Invoices created by your app
	// const unitdp = 4;  // {Integer} e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts

	// try {
	// 	const response: any = await xero.accountingApi.getInvoices(xeroTenantId, ifModifiedSince, where, order, iDs, invoiceNumbers, contactIDs, statuses, page, includeArchived, createdByMyApp, unitdp);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getitems
	// const ifModifiedSince = null;
	// const where = `IsPurchased==true`;  // {String} Filter by an any element
	// const order = "Name";  // {String} Order by an any element
	// const unitdp = 4;  // {Integer} e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts

	// try {
	// 	const response: any = await xero.accountingApi.getItems(xeroTenantId, ifModifiedSince, where, order, unitdp);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getjournals
	// const ifModifiedSince = null;
	// const offset = 10;  // {Integer} Offset by a specified journal number. e.g. journals with a JournalNumber greater than the offset will be returned
	// const paymentsOnly = true;  // {Boolean} Filter to retrieve journals on a cash basis. Journals are returned on an accrual basis by default.

	// try {
	// 	const response: any = await xero.accountingApi.getJournals(xeroTenantId, ifModifiedSince, offset, paymentsOnly);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getlinkedtransactions
	// const page = 1;  // {Integer} Up to 100 linked transactions will be returned in a single API call. Use the page parameter to specify the page to be returned e.g. page=1.
	// const linkedTransactionID = "19e45c06-6b42-4410-bada-f083b40d00de";  // {String} The Xero identifier for an Linked Transaction
	// const sourceTransactionID = "9575e6f9-fead-4456-bfba-aefed46937f2";  // {String} Filter by the SourceTransactionID. Get the linked transactions created from a particular ACCPAY invoice
	// const contactID = null;  // {String} Filter by the ContactID. Get all the linked transactions that have been assigned to a particular customer.
	// const status = "APPROVED";  // {String} Filter by the combination of ContactID and Status. Get  the linked transactions associaed to a  customer and with a status
	// const targetTransactionID = null;  // {String} Filter by the TargetTransactionID. Get all the linked transactions allocated to a particular ACCREC invoice

	// try {
	// 	const response: any = await xero.accountingApi.getLinkedTransactions(xeroTenantId, page, linkedTransactionID, sourceTransactionID, contactID, status, targetTransactionID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getmanualjournals
	// const ifModifiedSince = null;
	// const where = `Status=="${ManualJournal.StatusEnum.POSTED}"`;  // {String} Filter by an any element
	// const order = "Date";  // {String} Order by an any element
	// const page = 1;  // {Integer} e.g. page=1 – Up to 100 manual journals will be returned in a single API call with line items shown for each overpayment

	// try {
	// 	const response: any = await xero.accountingApi.getManualJournals(xeroTenantId, ifModifiedSince, where, order, page);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getorganisationcissettings
	// const organisationID = "923e41ab-3dce-4b6e-8e8c-49e1d7e19df7";  // {UUID} The unique Xero identifier for an organisation
	// try {
	// 	const response: any = await xero.accountingApi.getOrganisationCISSettings(xeroTenantId, organisationID);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getoverpayments
	// const ifModifiedSince = null;
	// const where = `Status=="${Overpayment.StatusEnum.AUTHORISED}"`;  // {String} Filter by an any element
	// const order = "Date";  // {String} Order by an any element
	// const page = 1;  // {Integer} e.g. page=1 – Up to 100 overpayments will be returned in a single API call with line items shown for each overpayment
	// const unitdp = 4;  // {Integer} e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts

	// try {
	// 	const response: any = await xero.accountingApi.getOverpayments(xeroTenantId, ifModifiedSince, where, order, page, unitdp);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getpayments
	// const ifModifiedSince = null;
	// const where = `Status=="${Payment.StatusEnum.AUTHORISED}"`;  // {String} Filter by an any element
	// const order = "Date";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getPayments(xeroTenantId, ifModifiedSince, where, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getprepayments
	// const ifModifiedSince = null;
	// const where = `Status=="${Prepayment.StatusEnum.AUTHORISED}"`;  // {String} Filter by an any element
	// const order = "Date";  // {String} Order by an any element
	// const page = 1;  // {Integer} e.g. page=1 – Up to 100 prepayments will be returned in a single API call with line items shown for each overpayment
	// const unitdp = 4;  // {Integer} e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts

	// try {
	// 	const response: any = await xero.accountingApi.getPrepayments(xeroTenantId, ifModifiedSince, where, order, page, unitdp);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getpurchaseorders
	// const ifModifiedSince = null;
	// const status = "AUTHORISED";  // {String} Filter by purchase order status
	// const dateFrom = "2019-12-01";  // {String} Filter by purchase order date (e.g. GET https://.../PurchaseOrders?DateFrom=2015-12-01&DateTo=2015-12-31
	// const dateTo = "2019-12-31";  // {String} Filter by purchase order date (e.g. GET https://.../PurchaseOrders?DateFrom=2015-12-01&DateTo=2015-12-31
	// const order = "Date";  // {String} Order by an any element
	// const page = 1;  // {Integer} To specify a page, append the page parameter to the URL e.g. ?page=1. If there are 100 records in the response you will need to check if there is any more data by fetching the next page e.g ?page=2 and continuing this process until no more results are returned.

	// try {
	// 	const response: any = await xero.accountingApi.getPurchaseOrders(xeroTenantId, ifModifiedSince, status, dateFrom, dateTo, order, page);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getquotes
	// const ifModifiedSince = null;
	// const dateFrom = "2013-10-20";  // {date} Filter for quotes after a particular date
	// const dateTo = "2013-10-20";  // {date} Filter for quotes before a particular date
	// const expiryDateFrom = "2013-10-20";  // {date} Filter for quotes expiring after a particular date
	// const expiryDateTo = "2013-10-20";  // {date} Filter for quotes before a particular date
	// const contactID = "54999de9-4690-4195-99bc-646970b23fb1";  // {UUID} Filter for quotes belonging to a particular contact
	// const status = "SENT";  // {String} Filter for quotes of a particular Status
	// const page = 1;  // {Integer} e.g. page=1 – Up to 100 Quotes will be returned in a single API call with line items shown for each quote
	// const order = "Date";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getQuotes(xeroTenantId, ifModifiedSince, dateFrom, dateTo, expiryDateFrom, expiryDateTo, contactID, status, page, order);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreceipts
	// const ifModifiedSince = null;
	// const where = `Status=="${Receipt.StatusEnum.DRAFT}"`;  // {String} Filter by an any element
	// const order = "Date";  // {String} Order by an any element
	// const unitdp = 4;  // {Integer} e.g. unitdp=4 – (Unit Decimal Places) You can opt in to use four decimal places for unit amounts

	// try {
	// 	const response: any = await xero.accountingApi.getReceipts(xeroTenantId, ifModifiedSince, where, order, unitdp);
	// 	console.log(response.body);
	// 	res.send('yo');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getrepeatinginvoices
	// const where = `Status=="${RepeatingInvoice.StatusEnum.AUTHORISED}"`;  // {String} Filter by an any element
	// const order = "Date";  // {String} Order by an any element

	// try {
	// 	const response: any = await xero.accountingApi.getRepeatingInvoices(xeroTenantId, where, order);
	// 	console.log(response.body);
	// 	res.send('blah');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreportbalancesheet
	// const date = "2019-11-01";  // {String} The date of the Balance Sheet report
	// const periods = 3;  // {Integer} The number of periods for the Balance Sheet report
	// const timeframe = "MONTH";  // {String} The period size to compare to (MONTH, QUARTER, YEAR)
	// const trackingOptionID1 = null;  // {String} The tracking option 1 for the Balance Sheet report
	// const trackingOptionID2 = null;  // {String} The tracking option 2 for the Balance Sheet report
	// const standardLayout = true;  // {Boolean} The standard layout boolean for the Balance Sheet report
	// const paymentsOnly = false;  // {Boolean} return a cash basis for the Balance Sheet report

	// try {
	// 	const response: any = await xero.accountingApi.getReportBalanceSheet(xeroTenantId, date, periods, timeframe, trackingOptionID1, trackingOptionID2, standardLayout, paymentsOnly);
	// 	console.log(response.body);
	// 	res.send('yo');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreportbanksummery
	// const fromDate = "2019-11-01";  // {date} The from date for the Bank Summary report e.g. 2018-03-31
	// const toDate = "2019-11-30";  // {date} The to date for the Bank Summary report e.g. 2018-03-31

	// try {
	// 	const response: any = await xero.accountingApi.getReportBankSummary(xeroTenantId, fromDate, toDate);
	// 	console.log(response.body);
	// 	res.send('ah');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreportbudgetsummary
	// const date = "2019-03-31";  // {date} The date for the Bank Summary report e.g. 2018-03-31
	// const period = 2;  // {Integer} The number of periods to compare (integer between 1 and 12)
	// const timeframe = 3;  // {Integer} The period size to compare to (1=month, 3=quarter, 12=year)

	// try {
	// 	const response: any = await xero.accountingApi.getReportBudgetSummary(xeroTenantId, date, period, timeframe);
	// 	console.log(response.body);
	// 	res.send('oh');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreportexecutivesummary
	// const date = "2019-03-31";  // {date} The date for the Bank Summary report e.g. 2018-03-31

	// try {
	// 	const response: any = await xero.accountingApi.getReportExecutiveSummary(xeroTenantId, date);
	// 	console.log(response.body);
	// 	res.send('oof');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreportprofitandloss
	// const fromDate = "2019-03-01";  // {date} The from date for the ProfitAndLoss report e.g. 2018-03-31
	// const toDate = "2019-03-31";  // {date} The to date for the ProfitAndLoss report e.g. 2018-03-31
	// const periods = 3;  // {Integer} The number of periods to compare (integer between 1 and 12)
	// const timeframe = "MONTH";  // {String} The period size to compare to (MONTH, QUARTER, YEAR)
	// const trackingCategoryID = null;  // {String} The trackingCategory 1 for the ProfitAndLoss report
	// const trackingCategoryID2 = null;  // {String} The trackingCategory 2 for the ProfitAndLoss report
	// const trackingOptionID = null;  // {String} The tracking option 1 for the ProfitAndLoss report
	// const trackingOptionID2 = null;  // {String} The tracking option 2 for the ProfitAndLoss report
	// const standardLayout = true;  // {Boolean} Return the standard layout for the ProfitAndLoss report
	// const paymentsOnly = false;  // {Boolean} Return cash only basis for the ProfitAndLoss report

	// try {
	// 	const response: any = await xero.accountingApi.getReportProfitAndLoss(xeroTenantId, fromDate, toDate, periods, timeframe, trackingCategoryID, trackingCategoryID2, trackingOptionID, trackingOptionID2, standardLayout, paymentsOnly);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreporttenninetynine
	// const reportYear = "2019";  // {String} The year of the 1099 report

	// try {
	// 	const response: any = await xero.accountingApi.getReportTenNinetyNine(xeroTenantId, reportYear);
	// 	console.log(response.body);
	// 	res.send('ok');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getreporttrialbalance
	// const date = "2019-10-31";  // {date} The date for the Trial Balance report e.g. 2018-03-31
	// const paymentsOnly = true;  // {Boolean} Return cash only basis for the Trial Balance report

	// try {
	// 	const response: any = await xero.accountingApi.getReportTrialBalance(xeroTenantId, date, paymentsOnly);
	// 	console.log(response.body);
	// 	res.send('hello');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// gettaxrates
	// const where = `Status=="${TaxRate.StatusEnum.ACTIVE}"`;  // {String} Filter by an any element
	// const order = "Name";  // {String} Order by an any element
	// const taxType = "INPUT";  // {String} Filter by tax type

	// try {
	// 	const response: any = await xero.accountingApi.getTaxRates(xeroTenantId, where, order, taxType);
	// 	console.log(response.body);
	// 	res.send('yup');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// gettrackingcategories
	// const where = `Status=="${TrackingCategory.StatusEnum.ACTIVE}"`;  // {String} Filter by an any element
	// const order = "Name";  // {String} Order by an any element
	// const includeArchived = true;  // {Boolean} e.g. includeArchived=true - Categories and options with a status of ARCHIVED will be included in the response

	// try {
	// 	const response: any = await xero.accountingApi.getTrackingCategories(xeroTenantId, where, order, includeArchived);
	// 	console.log(response.body);
	// 	res.send('yeah');
	// } catch (err) {
	// 	console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
	// 	console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	// }

	// getusers
	const ifModifiedSince = null;
	const where = `FirstName.Contains("e")`;  // {String} Filter by an any element
	const order = "FirstName";  // {String} Order by an any element

	try {
		const response: any = await xero.accountingApi.getUsers(xeroTenantId, ifModifiedSince, where, order);
		console.log(response.body);
		res.send('wat');
	} catch (err) {
		console.log(`There was an ERROR! \n Status Code: ${err.response.statusCode}.`);
		console.log(`Encountered the following Validation Errors: ${err.response.body.Elements[0].ValidationErrors.map((err, i) => `\n ${i + 1} ${err.Message}`).join(' ')}`);
	}

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`);
});