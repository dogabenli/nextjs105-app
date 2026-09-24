# Auth0 setup

## 1. Create the application

Create an Auth0 **Regular Web Application** for the Next.js server.

For local development use values similar to:

| Setting | Value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/api/auth/callback` |
| Allowed Logout URLs | `http://localhost:3000` |
| Allowed Web Origins | `http://localhost:3000` |

Use HTTPS URLs in shared environments.

## 2. Create the API

Create an Auth0 API:

| Setting | Example |
| --- | --- |
| Name | `Sitecore Member POC API` |
| Identifier / audience | `https://sitecore-member-poc-api` |
| Signing algorithm | `RS256` |

The identifier becomes `AUTH0_AUDIENCE` in Next.js and the expected audience in Sitecore.

## 3. Create roles and users

Create Auth0 roles:

- `member-basic`
- `member-premium`

Create three database-connection users:

| Persona | Role |
| --- | --- |
| Basic member | `member-basic` |
| Premium member | `member-premium` |
| Authenticated but unauthorized | none |

Do not commit user passwords. Store them in the team's approved secret manager or create them manually for each demo environment.

## 4. Add roles to the access token

Create a Post Login Action and bind it to the Login flow. Use a collision-resistant namespace owned by the POC, for example:

```js
exports.onExecutePostLogin = async (event, api) => {
  const claim = 'https://sitecore-poc.example/roles';
  const roles = event.authorization?.roles ?? [];
  api.accessToken.setCustomClaim(claim, roles);
};
```

The .NET adapter must read exactly the configured claim. Do not use email as an authorization role and do not infer permissions from the Auth0 connection name.

## 5. Next.js environment contract

Use the names required by the selected, pinned Auth0 SDK version. For the common Pages Router SDK pattern, expect:

```text
AUTH0_SECRET=<long random value>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<tenant>.<region>.auth0.com
AUTH0_CLIENT_ID=<regular-web-app-client-id>
AUTH0_CLIENT_SECRET=<regular-web-app-client-secret>
AUTH0_AUDIENCE=https://sitecore-member-poc-api
AUTH0_SCOPE=openid profile email
```

Keep `.env.local` out of source control. Provide only `.env.example` names and descriptions in the actual repository.

## 6. Sitecore environment contract

The Sitecore CD extension needs:

```text
Auth0.Authority=https://<tenant>.<region>.auth0.com/
Auth0.Audience=https://sitecore-member-poc-api
Auth0.RolesClaim=https://sitecore-poc.example/roles
Auth0.Enabled=true
```

Configure these through a Sitecore include patch or environment-specific role configuration. Do not put a client secret in Sitecore. Validating RS256 access tokens uses the issuer's public signing keys.

## 7. Token verification checklist

Decode one token only in a safe local tool and verify:

- `iss` exactly matches the configured authority;
- `aud` contains the API identifier;
- `sub` is present and stable;
- `exp` is in the future;
- the namespaced role claim contains the expected Auth0 role;
- the header uses the expected asymmetric algorithm and key id.

Decoding is inspection, not validation. The Sitecore backend must still verify the signature and all validation parameters.

## SDK compatibility note

The current Auth0 quickstart targets a newer App Router version of Next.js. This POC is based on the JSS 23 Pages Router starter. Inspect the installed Next.js version and pin a compatible major of `@auth0/nextjs-auth0`; do not copy current App Router file locations blindly.

