import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Milestone 3 scope only: interactive Auth0 login + server-side encrypted session.
// Sitecore virtual-user creation, role mapping, and Layout Service bearer forwarding
// are deliberately NOT implemented here yet.
export const auth0 = new Auth0Client({
  appBaseUrl: process.env.APP_BASE_URL,
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: process.env.AUTH0_SCOPE || 'openid profile email',
  },
});
