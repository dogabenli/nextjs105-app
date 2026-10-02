# On-demand ISR

## Public page contract

Public pages use the SSG catch-all with a five-second timed ISR interval. On-demand revalidation refreshes the requested page without waiting for that interval. Observing stale content before the API call is therefore timing-dependent.

## Endpoint contract

```text
POST /api/revalidate
x-revalidate-secret: <REVALIDATE_SECRET>
Content-Type: application/json

{ "path": "/about", "locale": "en" }
```

Successful response:

```json
{ "revalidated": true, "path": "/en/about" }
```

Do not put the secret in a query string because URLs are commonly logged.

## Validation rules

1. Accept `POST` only.
2. Compare the secret using a timing-safe comparison where practical.
3. Require a string path that begins with exactly one `/`.
4. Reject an absolute URL, protocol-relative URL, backslash, null byte, `..`, and unsupported query/hash content.
5. Normalize duplicate slashes and trailing slash consistently with the app.
6. If supplied, require `locale` to be one of `SUPPORTED_LOCALES` (`lib/locale-resolver.ts`). If omitted, use the configured default language; the endpoint does not infer locale from the request host. Submit a locale-free public path with an explicit `locale` when refreshing a non-default language.
7. Reject `/member` and every descendant after decoding and normalization, checked against the locale-free `path` (before the internal locale prefix is added).
8. Build the actual SSG page path as `` `/${locale}${normalizedPath}` `` (root maps to `/${locale}`) - this is the real route emitted by `src/pages/[locale]/[[...path]].tsx` and produced by the middleware's subdomain rewrite - and call `res.revalidate` with that value, not the public-facing locale-free path and not any other rewritten alias.

## Suggested helper functions

```text
readRevalidationSecret(req)
normalizePublicPath(input, language)
isProtectedPath(path)
```

Test these independently from the Next.js response object.

## Trigger options

For the first demo, call the endpoint manually after publishing. If automation is needed, add a minimal Sitecore publish-end handler that sends only the affected public routes. Do not make route dependency discovery part of this POC. A manual list of affected paths is acceptable.

## Test in production mode

`next dev` invokes static data fetching differently and does not prove ISR caching. Verify with:

```text
npm run build
npm run next:start
```

Then:

1. Load a public route.
2. Change and publish its Sitecore content.
3. Reload and observe the cached old output.
4. POST the exact path to the revalidation endpoint.
5. Reload and observe the new output.
6. Repeat the POST with `/member/page-1` and confirm rejection.

## Manual demo request (PowerShell)

Ensure Next.js has `REVALIDATE_SECRET` configured and restart the production server after changing it. PowerShell does not inherit values loaded by Next.js from `.env.local`. Enter the same secret at the hidden prompt below; do not print or commit it.

```powershell
$secureSecret = Read-Host 'Enter the configured REVALIDATE_SECRET' -AsSecureString
$env:REVALIDATE_SECRET = [System.Net.NetworkCredential]::new('', $secureSecret).Password

Invoke-RestMethod -Method Post `
	-Uri 'http://en.nextjs105.local:3000/api/revalidate' `
	-Headers @{ 'x-revalidate-secret' = $env:REVALIDATE_SECRET } `
	-ContentType 'application/json' `
	-Body '{"path":"/test-page"}'
```

With the default language configured as `en`, expect `revalidated: true` and `path: /en/test-page`. Reload `/test-page` to check the published content. For Danish, send `{"path":"/test-page","locale":"da"}` to refresh only `/da/test-page`.

## Scaling note

A single Next.js instance is sufficient for the POC. Multiple instances require a shared cache or an invalidation strategy that reaches each instance. Record that as a production follow-up, not a POC feature.

