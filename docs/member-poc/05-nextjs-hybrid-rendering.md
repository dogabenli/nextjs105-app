# Next.js hybrid rendering

## Route structure

Use physical route specificity, nested under the existing `[locale]` segment used for domain-based i18n (see [domain-based-i18n-ssg-isr.md](../language-subdomain-poc/domain-based-i18n-ssg-isr.md)):

```text
src/pages/
  [locale]/
    [[...path]].tsx           public SSG catch-all
    member/
      [[...path]].tsx          protected SSR route
  api/
    auth/[...auth0].ts         Auth0 Pages Router handlers
    revalidate.ts              public content invalidation
```

`locale` is not a URL segment the browser ever shows or the user ever types. It only exists because `src/lib/middleware/plugins/locale-rewrite.ts` rewrites every non-API, non-`_next` request (already including `/member` and its descendants, per the existing `proxy.ts` matcher) to prefix the pathname with the locale resolved from the request's subdomain. Do not add a second locale-detection mechanism (Host header parsing, `Accept-Language`, etc.) inside the member page - read `context.params.locale` exactly as `normal-mode.ts` does for the public route.

Do not try to export both `getStaticProps` and `getServerSideProps` from one page. Next.js chooses the rendering strategy at module/build time, not after inspecting the incoming Sitecore route.

## Public catch-all

Keep the JSS starter's SSG implementation and `SitecorePagePropsFactory`. For pure on-demand ISR, omit a timed `revalidate` value or use `revalidate: false`. Preserve `getStaticPaths` and the chosen fallback behavior. `getStaticPaths` must keep looping `SUPPORTED_LOCALES` to emit one `{ locale, path }` combination per locale, as already implemented.

The public fetch must remain anonymous. It must never read an Auth0 session or vary output by user. Header user information, if shown on public pages, should be a small client/session-aware island or be loaded from a same-origin session endpoint after hydration. Do not put a user name into cached public page props.

## Member SSR route

The explicit member page should:

1. Read locale from `context.params.locale` (populated by the subdomain middleware rewrite) - the same pattern `normal-mode.ts` uses, falling back to the resolved site's default language only if absent.
2. Reconstruct the Sitecore path from `context.params.path` and prefix `/member`. Do not include the `locale` param in the Sitecore path.
3. Obtain the Auth0 session from the request and response objects.
4. If missing, redirect to the login handler with a sanitized same-origin `returnTo` built from the locale-stripped current URL (see Redirect safety below) so the address bar keeps its clean, locale-free path.
5. Obtain an access token for the configured audience on the server.
6. Fetch layout data through the member layout client with the bearer header, passing the resolved locale exactly like the public layout service call does.
7. Map `401`, `403`, and not-found independently.
8. Set `Cache-Control: private, no-store`.
9. Return normal JSS page props without the access token.

Pseudocode:

```ts
export const getServerSideProps: GetServerSideProps = async (context) => {
  context.res.setHeader('Cache-Control', 'private, no-store');

  const session = await getSession(context.req, context.res);
  if (!session) return loginRedirectFor(stripLocalePrefix(context.resolvedUrl));

  const { accessToken } = await getAccessToken(context.req, context.res);
  const localeParam = context.params?.locale;
  const locale = (Array.isArray(localeParam) ? localeParam[0] : localeParam) ?? defaultLocale;
  const sitecorePath = toMemberSitecorePath(context.params?.path);
  const result = await memberPagePropsFactory.create(context, sitecorePath, locale, accessToken);

  if (result.status === 403) return forbiddenProps();
  if (result.notFound) return { notFound: true };
  return { props: result.props };
};
```

Use the actual Auth0 SDK signatures detected in the project. The pseudocode describes responsibilities, not a drop-in SDK-version-independent file.

`context.resolvedUrl` reflects the internally rewritten path (e.g. `/da/member/page-1`), because the middleware rewrite happens before Next.js resolves the page, not the original locale-free browser URL. `stripLocalePrefix` (add it next to `resolveLocaleFromHost` in `lib/locale-resolver.ts`) must remove that leading `/<locale>` segment before it is used to build a login `returnTo` or any other redirect target - otherwise the login callback would send the browser to a URL containing a literal `/da/...` segment that the rest of the app never generates or expects.

## Member layout client

Prefer an explicit wrapper over a global mutable token:

```ts
fetchLayoutForMember({ routePath, language, accessToken })
```

It can use `RestLayoutService` with a custom data fetcher or a small `fetch` wrapper matching the existing JSS client. Requirements:

- only import/call it from server-only code;
- attach `Authorization` per request;
- do not mutate a singleton's default headers;
- do not log request headers;
- keep the existing Sitecore API key if required by Layout Service;
- preserve language, site name, editing, and route query parameters.

## Header user display

Public pages are shared ISR output. Therefore, user-specific header content must not be part of the static HTML cache. For the POC, render a neutral placeholder and load `/api/me` after hydration, or use the Auth0 client session hook if compatible with the pinned SDK. Member SSR pages may render the user's display name, but still do not pass tokens.

## Redirect safety

Allow `returnTo` only when it is a relative local path beginning with `/` and not `//`. Strip any leading `/<locale>` segment (matching `SUPPORTED_LOCALES`) first, since that prefix only exists inside the middleware-rewritten request and must never leak into a redirect target. If validation fails, use `/member`. This avoids open redirects.

## Error pages

- `401`: restart login once or show a session-expired page. Avoid redirect loops.
- `403`: show a dedicated access-denied page for an authenticated user.
- `404`: use the normal JSS/Next.js not-found behavior.
- `5xx`: show the existing error page and retain diagnostic correlation IDs only.

