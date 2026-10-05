# Milestone 9: Standalone Sitecore Personalize

## Implementation

The app uses `@sitecore/engage` `1.4.3` with the existing Next.js Pages Router (installed `16.3.4`) and React `19.3.0`. Engage initialization is lazy and browser-only, mounted once through the application provider. It is disabled unless the feature flag, all validated settings, and the POC consent check are present. Initialization uses `forceServerCookieMode: false` and `webPersonalization: true`.

The initialized, typed client sends `pageView()` events. UTM collection is explicitly disabled. The Engage SDK can automatically attach its browser ID/client key and a first-visit external referrer as part of its standard event protocol; application code never reads or logs those identifiers or submits auth/session values. The hosted Web Personalization script owns `window.Engage`; it automatically evaluates the initial page. Following an eligible `routeChangeComplete`, the provider sends the new VIEW event and, only after it succeeds, calls the documented `window.Engage.triggerExperiences()` wrapper. The provider does not assign the typed client to a window global. The public page path comes from the browser-visible route, strips any internal supported-locale prefix, and sends no query string. Language comes from `resolveLocaleFromHost(window.location.host)`, the same locale resolver used by the application routing.

The `/personalize-demo` route continues through the public Sitecore catch-all and static generation/ISR. Personalize does not run during module import, SSR, SSG, or ISR; visitor-specific content is applied in the browser after hydration. Member routes remain on their existing SSR handler with `Cache-Control: private, no-store`, and are excluded from Personalize. The existing auth, Sitecore security, locale/authentication proxy, and on-demand ISR endpoint are unchanged.

## Local Configuration

Add these values to the uncommitted local environment configuration. Do not add a tenant client key to source control or documentation.

```env
NEXT_PUBLIC_PERSONALIZE_ENABLED=true
NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY=<personalize-client-key>
NEXT_PUBLIC_PERSONALIZE_TARGET_URL=<regional-engage-endpoint>
NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE=jss-poc-web
NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN=nextjs105.local
NEXT_PUBLIC_PERSONALIZE_CHANNEL=WEB
NEXT_PUBLIC_PERSONALIZE_CURRENCY=EUR
```

All seven variables must be valid. The flag must be exactly `true`; the endpoint must be HTTPS; the cookie domain must be a domain name without a scheme or path; channel and currency must be uppercase codes. Missing or invalid configuration disables the integration and leaves the default content in place. Restart Next.js after changing public environment variables.

There is no application consent manager. The provider uses an injectable consent-check function and defaults to no consent by checking the browser-only `personalize-demo-consent` local-storage key. For this local POC only, grant consent in the browser console with:

```js
localStorage.setItem('personalize-demo-consent', 'granted');
window.dispatchEvent(new Event('personalize-consent-change'));
```

Revoke the local override by removing that key and dispatching the same event. This is a test hook, not a production consent solution; production must integrate with the organization's consent manager and consent categories.

## Manual Sitecore Setup

The standalone Web Experience and the `jss-poc-web` Point of Sale are preconfigured external dependencies. The experience must remain Draft until all QA checks pass. No Sitecore items or Personalize experience are created, published, started, paused, or modified by this application.

1. In Sitecore, create or verify `/personalize-demo` and add exactly one existing Content Block rendering.
2. Assign a datasource with useful default `heading` and `content`; publish the page and datasource.
3. Revalidate `/personalize-demo` using the existing exact-path revalidation endpoint, then confirm the page resolves through the public catch-all with default content and no Personalize configuration.
4. In the existing draft Web Experience filter, select Point of Sale `jss-poc-web` if it has not already been assigned.
5. Configure the root selector as `[data-personalize-slot="content-block"]`; target only `.contentTitle` and/or `.contentDescription` within that root.
6. Use the existing page-targeting expression:

   ```regex
   ^http://(?:localhost|(?:en|da)\.nextjs105\.local):3000/personalize-demo/?(?:[?#].*)?$
   ```

7. Keep the variant idempotent: return if the root or expected children are absent, update existing children instead of appending duplicates, and never replace the React root or read authentication/protected data. The variant belongs only in the manually managed Personalize experience, never in Next.js application code.

The selector is sufficient only because this controlled demo has one Content Block. Production pages with multiple Content Blocks need a unique rendering-level identifier, such as the Sitecore rendering UID or a configured stable rendering identifier.

## CSP

There is no Content Security Policy in the repository's Next.js headers configuration; the policy is externally managed. No CSP was changed. Add only these origins to the externally managed policy after confirming the configured regional target URL and observing the browser requests:

- `script-src`: `https://d35vb5cccm4xzp.cloudfront.net`, the default Web Personalization script host used by `@sitecore/engage` `1.4.3`.
- `connect-src`: the origin of `NEXT_PUBLIC_PERSONALIZE_TARGET_URL`, used by the Engage event client. Include another origin only if the configured tenant or an officially configured `baseURLOverride` requires it.

Do not add wildcards or `unsafe-eval`. If Sitecore supplies a regional Web Personalization script host override, replace the script origin with that exact host. CSP remains a deployment-owner action because the policy is not managed here.

## Five-Minute Browser Verification

Use the language subdomains for final QA:

```text
http://en.nextjs105.local:3000/personalize-demo
http://da.nextjs105.local:3000/personalize-demo
```

1. Add the real local tenant values above, enable the feature flag, grant consent using the local POC override (or the production consent manager), and start Next.js.
2. Open the English demo URL. Confirm the default Content Block renders, then use Personalize QA/Preview while the experience is still Draft. Confirm only the intended heading/content changes.
3. Confirm there is one initial VIEW event. The initial hosted script evaluates the page automatically; the app does not call `triggerExperiences()` on initial load.
4. Navigate to another eligible public page using Next.js navigation. Confirm one additional VIEW and then one Web Experience evaluation. Return to `/personalize-demo` and confirm it runs again without duplicate markup.
5. Verify the event in the Personalize Event Viewer using the browser ID available in the browser tooling; do not log or persist that ID from application code. Confirm the event path is `/personalize-demo`, not `/en/personalize-demo` or `/da/personalize-demo`, and language follows the active host.
6. Confirm the Personalize cookie is scoped to `nextjs105.local`. `localhost:3000` cannot share a cookie scoped to `nextjs105.local`; do final cookie and experience QA on `en.nextjs105.local` and `da.nextjs105.local`.
7. Disable the feature flag or block the Personalize endpoint. Confirm default Sitecore content remains usable and no application error is raised.
8. Keep the experience in Draft until targeted/non-targeted behavior, the event count, cookie, and fallback have been checked. Do not start it live as part of this milestone.

For cache verification, run a production build, inspect the direct `/personalize-demo` response or generated output, and confirm it contains only the default Sitecore heading and content. Publish a datasource change, confirm the old cached default remains, then call the existing exact-path revalidation endpoint and confirm the new default appears before any browser-side variant. Personalize must not call revalidation or alter static/ISR output.

## Compatibility, Security, and Production Notes

The initial dependency/API spike confirms that `@sitecore/engage` `1.4.3` installs in the detected Next.js `16.3.4` / React `19.3.0` app. The SDK's declarations expose `init()` and typed `pageView()` but do not declare the hosted script's trigger. Sitecore's official [triggerExperiences reference](https://doc.sitecore.com/cdp/en/developers/api/engage-window-triggerexperiences.html) and [running personalization guide](https://doc.sitecore.com/cdp/en/developers/api/running-personalization.html) define `window.Engage.triggerExperiences()` as the hosted Web Personalization script API when `webPersonalization: true`. Production build and test compatibility results are recorded after verification below.

Only public event data is sent: configured channel, currency, Point of Sale, host-derived language, and the clean page path. No token, session, identity, role, protected content, server-only setting, or application error detail is included. Personalize is not an authorization system. Initialization, event, and hosted-trigger failures are swallowed with safe development-only diagnostic identifiers; default Sitecore content remains the source of truth.

Server-set cookies are a separate production hardening decision and are not implemented. The POC local-storage consent override is not production consent. A production deployment must integrate its consent platform, review the exact tenant/region CSP origins, and assess server-set cookie behavior separately.

**Verification record:** resolved versions are Next.js `16.3.4`, React `19.3.0`, and `@sitecore/engage` `1.4.3`. `npx tsc --noEmit`, formatting checks, changed-file lint, and all 9 Personalize tests pass. `npm run build` succeeds; its route table marks `/[locale]/[[...path]]` SSG/ISR and `/[locale]/member/[[...path]]` dynamic SSR. A generated static page contains the ContentBlock selector but no personalized marker or variant text; `/personalize-demo` has no dedicated static route artifact and remains covered by the fallback catch-all. With the user's current local configuration, an HTTP smoke request to `http://en.nextjs105.local:3000/personalize-demo` returned `200` with the ContentBlock selector and no variant text or member data. `http://da.nextjs105.local:3000/personalize-demo` returned `404`, so the Danish page is not currently verified. The full test command has one unrelated existing failure: `src/lib/member-page.test.ts` supplies `test-access-token`, which `decodeAccessTokenClaims` rejects as malformed. Repository-wide lint has one unrelated existing error in `src/Navigation.tsx` (`react-hooks/set-state-in-effect`). Browser-side consent, VIEW-event counts, hosted trigger execution, cookie scope, Personalize QA/Preview, Event Viewer, Point of Sale assignment, real consent integration, and live activation are not verified by these HTTP smoke checks and remain manual steps.
