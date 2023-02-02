# Xero NodeJS OAuth 2.0 Typescript Starter
This NodeJS Typescript project is meant to get you started interacting with the Xero API using the xero-node SDK and OAuth 2.0. 

Note: this project was built using Visual Studio Code and NodeJS

## How to use

### Configure with your credentials
Create an OAuth 2.0 app in Xero to get a *CLIENT_ID* and *CLIENT_SECRET*.

* Create a free Xero user account (if you don't have one) 
* Login to Xero Developer center https://developer.xero.com/app/manage/
* Click New app
* Enter a name for your app
* Select Web app
* Provide a valid URL (can be anything valid eg. https://www.myapp.com)
* Enter redirect URI: http://localhost:5000
* Tick to Accept the Terms & Conditions and click Create app
* On the left-hand side of the screen select Configuration
* Click Generate a secret

Create a `.env` file in the root of your project & replace the 3 variables eg.
> touch .env

or
> nano .env
```
CLIENT_ID=...
CLIENT_SECRET=...
REDIRECT_URI=...
```

### Build and run

```sh
npm install
npm run dev
```
