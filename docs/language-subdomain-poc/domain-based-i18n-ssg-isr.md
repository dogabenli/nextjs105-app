# POC: Domain-based language routing - SSG/ISR/on-demand-ISR approach (Sitecore JSS Next.js, Pages Router)

- **Date:** 2026-09-15
- **Status:** Implemented, verified for `en` and `da`
- **Stack:** Sitecore 10.5, Sitecore JSS 23, Next.js 16 (Pages Router)
- **Supersedes the SSG/ISR trade-off** described in
  [domain-based-i18n-ssr.md](domain-based-i18n-ssr.md). Read that doc first for the
  requirement, the `i18n.domains` bug writeup, and the JSS `Link`/`LinkField` compatibility
  notes - all of that still applies unchanged. This doc only covers what's different: how
  SSG/ISR/on-demand ISR were restored.
- **Also see the `languageEmbedding` fix** in that same doc's Link/LinkField section: Sitecore
  was embedding a `/da/...` segment in generated internal links for non-default languages. That
  is a Sitecore site-config setting (`languageEmbedding="never"`), unrelated to the
  SSR-vs-SSG/ISR choice covered here - it applies identically either way.

## Why this exists

The first working version ([domain-based-i18n-ssr.md](domain-based-i18n-ssr.md)) resolved the
locale from the request's `Host` header inside `getServerSideProps`, which meant **every**
Sitecore-driven page rendered on demand (SSR) - no static generation, no ISR, no on-demand
revalidation. That's a real cost for a JSS app that would otherwise benefit from SSG/ISR.

This approach restores SSG/ISR by moving locale detection **out of the page function and into
middleware**, using an invisible rewrite - the same general technique used for manual i18n
before Next.js had built-in i18n support (and the same idea App Router users rely on today,
since App Router has no built-in i18n at all).

## Architecture

1. **`src/lib/middleware/plugins/locale-rewrite.ts`** (new) resolves the locale from the
   request's `Host` header (`resolveLocaleFromHost`) and does `NextResponse.rewrite()` to
   prepend it to the pathname - e.g. a request to `da.nextjs105.local/about` is invisibly
   rewritten to `/da/about` internally. The browser's address bar and the public-facing URL
   never change; this is a server-side-only routing decision.
   ```ts
   const locale = resolveLocaleFromHost(req.headers.get('host') ?? undefined);
   const url = req.nextUrl.clone();
   url.pathname = `/${locale}${pathname}`;
   return NextResponse.rewrite(url);
   ```
   A guard skips the rewrite if the path is already locale-prefixed (avoids double-rewriting).

2. **`src/proxy.ts`** matcher was extended to also include `/_next/data/:path*` (previously
   entirely excluded alongside the rest of `/_next/`). This is required so that client-side
   SSG/ISR navigations (which fetch `/_next/data/<buildId>/...json`) get the same locale
   rewrite as the initial page request - otherwise soft navigations would fetch the wrong
   locale's cached JSON.
   ```ts
   matcher: [
     '/',
     '/((?!api/|_next/|healthz|sitecore/api/|-/|favicon.ico|sc_logo.svg).*)',
     '/_next/data/:path*',
   ],
   ```

3. **Route restructuring**: `src/pages/[[...path]].tsx` (SSR) was replaced by
   `src/pages/[locale]/[[...path]].tsx`. The `locale` param is never visible in the browser -
   it only exists because of the middleware rewrite above. This brought back:
   - `getStaticPaths`: enumerates `{ locale, path }` combinations by looping
     `SUPPORTED_LOCALES` and calling `sitemapFetcher.fetch({ ...context, locales: [locale] })`
     for each (the JSS SDK's `GraphQLSitemapService.fetchSSGSitemap(locales)` already supports
     fetching per-locale paths - it's designed for Next's built-in i18n `getStaticPaths` shape,
     we just re-map its `{ params, locale }` output into `{ params: { ...params, locale } }`
     for our own `[locale]` segment instead).
   - `getStaticProps`: unchanged from the original boilerplate, `revalidate: 5` restored (ISR).
   - `fallback: 'blocking'`: first request for an unbuilt `{locale, path}` combo renders on
     demand and gets cached from then on, same as the original single-locale setup.

4. **`src/lib/page-props-factory/plugins/normal-mode.ts`**: locale now comes from
   `context.params.locale` (the route param) instead of `req.headers.host`:
   ```ts
   const localeParam = context.params?.locale;
   props.locale = (Array.isArray(localeParam) ? localeParam[0] : localeParam) ?? props.site.language;
   ```
   This works identically for `getStaticProps` (build/ISR-time regeneration) and any future
   `getServerSideProps` usage, since it no longer depends on the request being present.

5. **`src/Navigation.tsx`** (language switcher) is unchanged - it already builds absolute
   cross-domain hrefs from `window.location.host` client-side, independent of the page's
   internal route structure.

## Gotchas found while implementing this

- **PowerShell and `Remove-Item` with bracketed filenames.** Deleting the old
  `src/pages/[[...path]].tsx` with `Remove-Item -Path "src/pages/[[...path]].tsx"` silently did
  **nothing** - PowerShell treats `[...]` as wildcard character-class syntax, not a literal
  filename. Use `-LiteralPath` instead:
  ```powershell
  Remove-Item -LiteralPath 'src/pages/[[...path]].tsx' -Force
  ```
  Leaving both the old top-level catch-all and the new `[locale]/[[...path]]` catch-all in
  place at the same time caused confusing symptoms (stale `.next` dev cache made it look like
  content was rendering twice) until this was caught and fixed.
- **Always clear `.next` after restructuring page files.** When a page file is moved/renamed,
  clear the dev cache (`Remove-Item -Recurse -Force .next`) before restarting - otherwise the
  dev server can serve stale route manifests that don't match the new file layout.
- **A genuinely duplicated "Welcome to Sitecore JSS" ContentBlock on the homepage turned out to
  be a pre-existing Sitecore content issue, not a code bug.** Traced it by querying the Layout
  Service directly (bypassing Next.js entirely):
  ```powershell
  Invoke-WebRequest -Uri "https://<cm-host>/sitecore/api/layout/render/jss?item=/&sc_apikey=<key>&sc_lang=en&sc_site=nextjs105-app" -UseBasicParsing
  ```
  The raw JSON response contained the `ContentBlock` rendering **twice** in the `jss-main`
  placeholder (two different `uid`s, identical fields) for the home item specifically -
  `/styleguide` returned it once, as expected. This needs to be fixed in Sitecore (remove the
  duplicate rendering from the home item's Layout Details), not in app code. Worth remembering
  as a debugging technique: when content looks duplicated/wrong in the browser, check the raw
  Layout Service response before assuming it's a React/Next.js bug.
- Stale leftover dev server processes from earlier restarts can silently grab port 3000 first,
  pushing the "real" server to 3001 without it being obvious from the browser alone (the dev
  server logs `⚠ Port 3000 is in use by process <pid>, using available port 3001 instead.` -
  watch for this line after restarts).

## Testing performed

- `npm run build`: `/[locale]/[[...path]]` correctly builds `/en`, `/da`, `/en/styleguide`,
  `/da/styleguide`, `/en/graphql(/sample-1|sample-2)`, `/en/styleguide/custom-route-type` etc.
  as **● (SSG)** with `Revalidate: 5s` / `Expire: 1y` in the build output - confirming ISR is
  active again (compare to the SSR approach's build output, which showed `ƒ` / fully dynamic).
- Verified both domains resolve to the correct Sitecore language by sending requests with an
  explicit `Host` header directly to the Next.js server (bypassing DNS/hosts file, to rule out
  browser-level caching):
  ```powershell
  Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -Headers @{Host='da.nextjs105.local:3000'}
  ```
  `da.nextjs105.local` → `itemLanguage:"da"`, page title `Welcome to Sitecore JSS [da]`, body
  content in Danish. `en.nextjs105.local` → English content, `/styleguide` → 200.
- Did **not** get to fully verify soft/client-side `<Link>` navigation across different paths on
  the same domain in the browser this session (browser tooling was unavailable at the time) -
  see [Known open question](#known-open-question-client-side-soft-navigation) below.

## Known open question: client-side soft navigation

Because `locale` is a real dynamic route segment (populated only via middleware rewrite, not by
Next's `i18n` system), Next.js has **no built-in mechanism to auto-carry the current locale
across client-side navigations** the way it does for its own `i18n.locale`. A `<Link href="/some-page">`
click is a plain relative navigation with no knowledge of `locale` as a special concept - the
question is whether Next's client router correctly re-derives it via the middleware-rewritten
`_next/data` request (added to the matcher in step 2 above) or whether this needs additional
handling (e.g. explicitly building hrefs, or forcing hard navigation for internal links).
**This needs a follow-up manual test**: click an internal link (e.g. Navigation's "Styleguide"
link) from the homepage on `da.nextjs105.local` and confirm the resulting page is still in
Danish and doesn't error, without a full page reload. If it breaks, the pragmatic fallback is to
disable client-side transitions for internal links (accept hard navigation), since the
SSG/ISR/caching benefits at the server level are unaffected either way.

## Production considerations

- Same as the SSR approach doc for DNS/subdomains, `PUBLIC_URL`, and Sitecore language
  prerequisites - unchanged.
- Additionally: the `/_next/data/:path*` matcher addition means middleware now runs on more
  requests than before (every client-side SSG/ISR data fetch, not just page navigations).
  Middleware itself is cheap here (just a header read + rewrite), but worth keeping in mind if
  more middleware plugins are added later.
- `getStaticPaths` fetches `sitemapFetcher.fetch(...)` once per locale at build time - for sites
  with many locales and many pages, watch build time/memory as this scales linearly with
  `SUPPORTED_LOCALES.length`.
