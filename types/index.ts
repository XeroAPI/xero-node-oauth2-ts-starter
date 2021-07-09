import { Session } from 'express-session'
import { TokenSet } from 'openid-client';
import { XeroAccessToken, XeroIdToken } from 'xero-node';

declare module 'express-session' {
  interface Session {
    decodedAccessToken: XeroAccessToken;
    decodedIdToken: XeroIdToken;
    tokenSet: TokenSet;
    allTenants: any[];
    activeTenant: any;
  }
}