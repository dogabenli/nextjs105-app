# POC: Domain-based language routing - SSR approach (Sitecore JSS Next.js, Pages Router)

- **Date:** 2026-09-15
- **Status:** Implemented, verified for `en` (and `da` on the homepage)
- **Stack:** Sitecore 10.5, Sitecore JSS 23, Next.js 16 (Pages Router)
- **See also:** [domain-based-i18n-ssg-isr.md](domain-based-i18n-ssg-isr.md) for the follow-up
  approach that restores SSG/ISR/on-demand ISR via a middleware rewrite instead of SSR.

## Requirement

By default, JSS Next.js apps route languages as a path slug: `{hostname}/en`, `{hostname}/da`.
The requirement here is to route languages via **subdomains** instead: `en.{hostname}`,
`da.{hostname}` (POC domains: `en.nextjs105.local`, `da.nextjs105.local`), with no locale segment
in the URL path at all.

## TL;DR architecture

- **Not using Next.js's built-in `i18n` config.** It looked like the obvious tool for this
  (`i18n.domains`), but it's broken in this Next.js version when combined with `next.config.js`
  `rewrites()` (needed for Sitecore proxying) - see [Why we don't use `i18n.domains`](#why-we-dont-use-i18ndomains) below.
- Locale is resolved **manually from the request's `Host` header**, in
  [src/lib/locale-resolver.ts](../../src/lib/locale-resolver.ts).
- Because host-based resolution needs the actual request, the catch-all page
  ([src/pages/[[...path]].tsx](../../src/pages/%5B%5B...path%5D%5D.tsx)) was converted from
  **SSG (`getStaticProps`/`getStaticPaths`) to SSR (`getServerSideProps`)**. This is the main
  architectural trade-off of this approach: no more static generation/ISR for content pages.
  **See [domain-based-i18n-ssg-isr.md](domain-based-i18n-ssg-isr.md) for how this was later
  removed** by moving locale detection into middleware instead of the page function.
- [normal-mode.ts](../../src/lib/page-props-factory/plugins/normal-mode.ts) resolves
  `props.locale` from the host and passes it straight to the Layout/Dictionary services as the
  Sitecore language - no mapping layer needed, because the subdomain label (`en`, `da`) matches
  the real Sitecore language name exactly in this environment.
- A small language switcher was added to [Navigation.tsx](../../src/Navigation.tsx), computed
  client-side (post-mount) from `window.location.host`.

## Why we don't use `i18n.domains`

Next.js's Pages Router has a built-in `i18n` config that supports per-domain default locales:

```js
i18n: {
  locales: ['en', 'da'],
  defaultLocale: 'en',
  localeDetection: false,
  domains: [
    { domain: 'en.nextjs105.local', defaultLocale: 'en', http: true },
    { domain: 'da.nextjs105.local', defaultLocale: 'da', http: true },
  ],
},
```

This was the first approach tried, and it worked for the `en` domain (which happens to match the
global `defaultLocale`), but **broke for `da`** with:

```
Invariant: attempted to hard navigate to the same URL /da http://da.nextjs105.local:3000/
    at handleHardNavigation ...router.js:409
    at Router.change ...router.js:779
    at Router.replace ...router.js:635
    at Container.componentDidMount ...client/index.js:89
```

Root cause (traced through `node_modules/next/dist`):
- `next.config.js` defines a `rewrites()` function (needed for Sitecore media/API proxying),
  which sets an internal `__NEXT_HAS_REWRITES` flag.
- With `i18n.domains` configured, Next.js internally rewrites the pathname to include the locale
  prefix (e.g. `/da`) for any domain whose `defaultLocale` differs from the global
  `defaultLocale` - this is meant to be purely internal/invisible to the browser.
- Because `__NEXT_HAS_REWRITES` is true, Next's client bootstrap (`Container.componentDidMount`)
  forces a `router.replace()` "to resolve rewrite params" on every SSG page mount, using the
  leaked `/da`-prefixed `asPath`. That re-triggers domain-locale detection on an already-prefixed
  path, and Next's own invariant guard throws because it thinks it needs to hard-navigate to a
  URL identical to the one it's already on.
- Only domains whose `defaultLocale` differs from the global `defaultLocale` are affected, which
  is why `en.` "worked" (it *is* the global default and never gets prefixed) while `da.` didn't.

This is a genuine framework-level conflict between `i18n.domains` and `rewrites()`, not something
fixable from app code, so it was abandoned in favor of manual host-based resolution (see
[docs/issues/2026-09-14-infinite-reload-loop-domain-based-i18n.md](../issues/2026-09-14-infinite-reload-loop-domain-based-i18n.md)
for a related, earlier dev-only bug found while first setting up these domains).

**Not specific to Next 16.** The `Container.componentDidMount` logic that triggers this
(`initialData.props.__N_SSG && (location.search || process.env.__NEXT_HAS_REWRITES || ...)` ->
forced `router.replace()`) is present verbatim in Next 15.5.4's `client/index.js` too (compared
directly against the Next 16.3.4 source). This is long-standing Pages Router behavior, not a v16
regression - the same `i18n.domains` + `rewrites()` conflict would reproduce on Next 15 (and
likely earlier versions) as well, wherever both features are combined.

## Implementation

### 1. `next.config.js`
The `i18n` block was removed entirely. `rewrites()`, `allowedDevOrigins` (`*.nextjs105.local`),
and the CORS headers for `/_next/*` in dev remain unchanged and are still required.

### 2. `src/lib/locale-resolver.ts` (new)
```ts
export const SUPPORTED_LOCALES = ['en', 'da'];

export function resolveLocaleFromHost(host: string | undefined): string {
  const subdomain = host?.split(':')[0].split('.')[0];
  return subdomain && SUPPORTED_LOCALES.includes(subdomain)
    ? subdomain
    : config.defaultLanguage;
}

export function buildLocaleSwitchHref(host: string, path: string, targetLocale: string): string {
  const [, ...domainParts] = host.split('.');
  return `//${[targetLocale, ...domainParts].join('.')}${path}`;
}
```
Pure functions, usable both server-side (`req.headers.host`) and client-side
(`window.location.host`).

### 3. `src/pages/[[...path]].tsx`
`getStaticPaths` + `getStaticProps` (with `revalidate`/ISR) were replaced with a single
`getServerSideProps`. `lib/sitemap-fetcher` is no longer used by this page. This means every
request to a Sitecore-driven route now renders on demand (SSR) rather than serving a
statically-generated/cached page.

### 4. `src/lib/page-props-factory/plugins/normal-mode.ts`
```ts
const host = isServerSidePropsContext(context) ? context.req.headers.host : undefined;
props.locale = resolveLocaleFromHost(host) ?? props.site.language;
```
This value flows straight into `layoutService.fetchLayoutData(path, props.locale, ...)` and
`dictionaryService.fetchDictionaryData(props.locale)` - i.e. the subdomain label is used
**directly as the Sitecore language name**. No mapping layer is needed in this environment
because the real Sitecore language is `da` (not `da-DK`). If your Sitecore language name and the
friendly subdomain label ever diverge, add a small map in `locale-resolver.ts` before passing the
value to the services.

`preview-mode.ts` (Sitecore Experience Editor) is untouched - it already gets its language from
the editing session data, independent of host/domain.

### 5. Language switcher (`src/Navigation.tsx`)
Renders one link per `SUPPORTED_LOCALES` entry, computed **client-side only** (via `useEffect` +
`window.location.host`, gated behind a `host` state that starts `undefined`) to avoid an
SSR/CSR hydration mismatch, since the target host is only knowable in the browser:

```tsx
const [host, setHost] = useState<string | undefined>(undefined);
useEffect(() => setHost(window.location.host), []);
const currentLocale = resolveLocaleFromHost(host);
...
{host && SUPPORTED_LOCALES.map((locale) => (
  <a key={locale} href={buildLocaleSwitchHref(host, asPath, locale)}>{locale.toUpperCase()}</a>
))}
```

### 6. JSS `Link` / `LinkField` compatibility - needs one Sitecore-side setting
Content-authored internal links (e.g. `internalLink`/`paramsLink` fields in
[Styleguide-FieldUsage-Link.tsx](../../src/components/fields/Styleguide-FieldUsage-Link.tsx))
need **no Next.js code changes**. Traced through `@sitecore-jss/sitecore-jss-nextjs`'s `Link`
component: for internal hrefs (matching `/^\//`, not a file extension) it renders `next/link`
with **`locale: false` hardcoded** and the href passed through as-is (relative path). Since we
don't use Next's `i18n` at all, this is moot for locale-prefixing, and these links always
resolve relative to the **current origin/domain** - they never jump domains.

**However, the href itself is generated by Sitecore, not by our code** - and by default Sitecore
embeds a language segment in generated links (rich text links, `LinkField`s, etc.) whenever the
current language differs from the site's default language. This showed up as internal links on
`da.nextjs105.local` pointing to `/da/styleguide` instead of `/styleguide` (the `en` site default
never showed a prefix, since `en` matched the site's inherited default - only non-default
languages were affected, which is why it wasn't caught until `da` content was actually linked to).

This is controlled by Sitecore's site definition **`languageEmbedding`** attribute (`always` /
`never` / `asNeeded`) - unset, it inherits `asNeeded` from the `website` site. Since our
architecture conveys language via subdomain (never via path), the fix is to set it to `never` in
[sitecore/config/nextjs105-app.config](../../sitecore/config/nextjs105-app.config):
```xml
<site patch:before="site[@name='website']"
      inherits="website"
      name="nextjs105-app"
      hostName="nextjs105-app.dev.local"
      rootPath="/sitecore/content/nextjs105-app"
      startItem="/home"
      database="master"
      languageEmbedding="never" />
```
This patch file needs to be (re)deployed to Sitecore (`jss deploy config`, or manually copied to
`App_Config/Include` and the CM app pool recycled) before it takes effect - a code-only change
in this repo isn't enough on its own.

External/email/file-extension/edit-mode links fall through to a plain `sitecore-jss-react`
anchor, unaffected either way.

One thing to watch for: some of the sample styleguide content has a link hardcoded to `/en`
(a leftover from when locale was a path segment). That's stale sample content, not a code issue -
new/real content should use plain paths with no locale segment, since the domain now implies the
language.

## Sitecore prerequisites

- The site (`nextjs105-app`) must support each language you want to route (`en`, `da`, ...).
- `languageEmbedding="never"` must be set on the site definition (see above) so Sitecore never
  embeds a language path segment in generated links, regardless of current language.
- A real Sitecore language item named exactly `da` was added for this POC (**not** `da-DK`).
  The repo also ships unrelated dummy scaffold files
  (`data/routes/styleguide/da-DK.yml`, `data/dictionary/da-DK.yml`) from the JSS sample
  boilerplate - these are unused/irrelevant here and were intentionally left untouched.
- Content must actually be authored in each language for a route to resolve; at the time of this
  POC, `da` content exists for the homepage but not yet for `/styleguide`, so DA testing was
  limited to the homepage (see [Testing performed](#testing-performed)).

## Local dev setup

1. Hosts file entries (already present for this POC):
   ```
   127.0.0.1 en.nextjs105.local
   127.0.0.1 da.nextjs105.local
   ```
2. `.env.local` (gitignored) must have `PUBLIC_URL=` (empty) - unrelated to i18n, but required to
   avoid an infinite reload loop caused by `assetPrefix` defaulting to `http://localhost:3000`
   while browsing a different domain. Full write-up:
   [docs/issues/2026-09-14-infinite-reload-loop-domain-based-i18n.md](../issues/2026-09-14-infinite-reload-loop-domain-based-i18n.md).
3. `npm run start:connected`, then browse `http://en.nextjs105.local:3000/` /
   `http://da.nextjs105.local:3000/`.

## Testing performed

- `http://en.nextjs105.local:3000/` - loads correct English content, no reload loop.
- `http://da.nextjs105.local:3000/` - loads correct **Danish** content pulled from Sitecore
  ("Welcome to JSS! [DA]" / "Danish language" heading/body), confirming host → Sitecore language
  resolution works end-to-end.
- Language switcher: clicking `EN`/`DA` correctly navigates across domains while preserving the
  current path.
- `Styleguide-FieldUsage-Link.tsx` (JSS `Link`/`LinkField`) on `en.` - internal/external/email/
  params links all rendered and behaved correctly (internal link stayed relative to current
  domain, as expected). Not yet re-tested on `da.` since that route has no Danish content yet.
- `npm run build` - succeeds; `/[[...path]]` is correctly marked `ƒ` (dynamic/SSR) instead of
  `○`/`●` (static), confirming the SSG → SSR conversion took effect.

## Production considerations

- **SSG/ISR is gone for Sitecore-driven pages.** Every request now hits `getServerSideProps`,
  meaning higher latency and load per-request compared to the previous static+ISR setup. Evaluate
  whether a CDN/cache layer in front of the app (e.g. cache by `Host` + path) is needed to
  compensate.
- Each language subdomain needs real DNS + routing to the same app instance/deployment.
- `PUBLIC_URL` should be set appropriately (not left empty) for any environment that needs
  absolute URLs (e.g. Sitecore Experience Editor/CM rendering requests) - the empty value here is
  a local-dev-only workaround.
- If a Sitecore language name and the desired friendly subdomain ever diverge (e.g. subdomain
  `da` but Sitecore language `da-DK`), add an explicit mapping in `locale-resolver.ts` rather than
  assuming they match.
