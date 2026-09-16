# Infinite reload loop when using domain-based i18n in local dev

- **Date:** 2026-09-14
- **Status:** Resolved
- **Affected area:** Local development (`jss start:connected`), `next.config.js` i18n domains, HMR/Fast Refresh

## Symptom

After configuring language-based domains for i18n (`en.nextjs105.local`, `da.nextjs105.local`) in the hosts file and in `next.config.js`, running `jss start:connected` and browsing to `http://en.nextjs105.local:3000/` caused the page to reload continuously in an infinite loop. Terminal logs showed the initial request compiling normally, then endless rapid repeated `GET /` requests:

```
GET / 200 in 11.4s (next.js: 10.3s, proxy.ts: 994ms, application-code: 131ms)
GET / 304 in 133ms (next.js: 20ms, proxy.ts: 95ms, application-code: 17ms)
GET / 304 in 43ms (next.js: 13ms, proxy.ts: 11ms, application-code: 19ms)
GET / 304 in 36ms (next.js: 12ms, proxy.ts: 9ms, application-code: 16ms)
... (repeats indefinitely, ~30-50ms apart)
```

## Configuration in place

`next.config.js` used Next.js's built-in `i18n.domains` feature for per-domain default locales:

```js
i18n: {
  locales: ['en', 'da'],
  defaultLocale: jssConfig.defaultLanguage,
  localeDetection: false,
  domains: [
    { domain: 'en.nextjs105.local', defaultLocale: 'en', http: true },
    { domain: 'da.nextjs105.local', defaultLocale: 'da', http: true },
  ],
},
```

`assetPrefix` was set unconditionally to `publicUrl` (from `temp/config`, which is `PUBLIC_URL`):

```js
const publicUrl = jssConfig.publicUrl;
const nextConfig = {
  assetPrefix: publicUrl,
  ...
};
```

`PUBLIC_URL` was not set in `.env`, so it defaulted to `http://localhost:3000` (see `getPublicUrl()` in `@sitecore-jss/sitecore-jss-nextjs`).

## Investigation

1. Ruled out an app-level redirect loop: searched the codebase for `router.push`/`router.replace`/`NextResponse.redirect`/`window.location` — none found outside the base middleware scaffolding.
2. Ruled out `i18n.domains` causing an HTTP redirect loop: Next.js only performs a locale-detection redirect on `/` when `i18n.localeDetection !== false` (see `next/dist/shared/lib/i18n/get-locale-redirect.js`). This app explicitly sets `localeDetection: false`, so no redirect is issued; domain-to-locale mapping is applied as an internal rewrite only (see `next/dist/server/lib/router-utils/resolve-routes.js`).
3. Initially suspected Next.js 16 had removed `i18n` support entirely (an early grep of `node_modules/next` returned no hits for `i18n`), but this was a false lead — the grep tool excludes ignored/`node_modules` paths by default. Re-running with `includeIgnoredFiles: true` confirmed `i18n` (including `domains`) is still fully implemented in Next.js 16 for the Pages Router.
4. Found the real cause in the Next.js dev client: the HMR/Fast-Refresh WebSocket URL is derived directly from `assetPrefix`, not from the current page's origin (`node_modules/next/dist/client/dev/hot-reloader/get-socket-url.js`):

   ```js
   function getSocketUrl(assetPrefix) {
     const prefix = normalizedAssetPrefix(assetPrefix);
     const protocol = getSocketProtocol(assetPrefix || '');
     if (URL.canParse(prefix)) {
       // assetPrefix is an absolute URL -> use it as-is for the socket URL
       return prefix.replace(/^http/, 'ws');
     }
     // otherwise fall back to window.location host/port
     ...
   }
   ```

   Since `assetPrefix` was the absolute URL `http://localhost:3000`, the browser (loaded from `en.nextjs105.local:3000`) always tried to open its HMR socket to `ws://localhost:3000/_next/webpack-hmr` — a different host than the page itself.

5. That cross-host WebSocket connection fails/is rejected. `node_modules/next/dist/client/dev/hot-reloader/pages/websocket.js` reconnects a limited number of times (`WEB_SOCKET_MAX_RECONNECTIONS`) and, once exceeded, calls `window.location.reload()`. The reload re-runs the same client bootstrap, which immediately retries the same broken cross-host socket, exhausts the reconnection budget again, and reloads again — producing the observed infinite loop (slow first compile, then continuous fast reloads).

## Root cause

`assetPrefix` was hardcoded to `http://localhost:3000` (the default when `PUBLIC_URL` is unset), which mismatched the domain actually being browsed (`en.nextjs105.local` / `da.nextjs105.local`). The Next.js dev HMR client uses `assetPrefix` to compute its WebSocket URL, so it always tried to connect back to `localhost:3000` regardless of which domain served the page, causing the socket to fail and triggering repeated forced full-page reloads.

This was **not** caused by the `i18n.domains` configuration or by any app/middleware redirect logic.

## Resolution

Created `.env.local` (gitignored, local-only) with `PUBLIC_URL` explicitly set to empty:

```env
PUBLIC_URL=
```

With `PUBLIC_URL` empty, `assetPrefix` is falsy/relative instead of an absolute `http://localhost:3000` URL. `getSocketUrl` then falls back to using the current page's `window.location` host/port to build the HMR WebSocket URL, so it always matches whichever domain is being browsed (`en.nextjs105.local`, `da.nextjs105.local`, etc.), and the reload loop stops.

After restarting the dev server (`npm run start:connected`), the loop no longer occurs.

## Notes / follow-ups

- `PUBLIC_URL` is still needed (set in `.env`, not `.env.local`) for scenarios requiring absolute URLs, such as rendering through the Sitecore Experience Editor/CM, or production non-relative deployments. Only leave it empty for local, direct-browser, multi-domain development like this one.
- When multiple language domains are used for local dev, prefer relative asset URLs (`PUBLIC_URL=` empty) unless you specifically need the app reachable through Sitecore's editors on one canonical host.
- When investigating issues inside `node_modules`, remember that `grep_search` excludes ignored paths by default — pass `includeIgnoredFiles: true` or results will be misleadingly empty and can lead to false conclusions (as happened here with the initial "i18n removed in Next 16" false lead).
