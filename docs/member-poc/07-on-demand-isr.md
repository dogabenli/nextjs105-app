# On-demand ISR

## Public page contract

Public pages use the SSG catch-all. They do not use timed regeneration in the first POC iteration. The cached page changes only when the revalidation API receives a valid request for the exact public path.

## Endpoint contract

```text
POST /api/revalidate
Authorization: Bearer <REVALIDATION_SECRET>
Content-Type: application/json

{ "path": "/about", "language": "en" }
```

Successful response:

```json
{ "revalidated": true, "path": "/about" }
```

Do not put the secret in a query string because URLs are commonly logged.

## Validation rules

1. Accept `POST` only.
2. Compare the secret using a timing-safe comparison where practical.
3. Require a string path that begins with exactly one `/`.
4. Reject an absolute URL, protocol-relative URL, backslash, null byte, `..`, and unsupported query/hash content.
5. Normalize duplicate slashes and trailing slash consistently with the app.
6. Require `language` to be one of `SUPPORTED_LOCALES` (`lib/locale-resolver.ts`). The public-facing `path` itself must stay locale-free, matching the domain-based scheme where locale comes from the subdomain, not a path segment.
7. Reject `/member` and every descendant after decoding and normalization, checked against the locale-free `path` (before the internal locale prefix is added).
8. Build the actual SSG page path as `` `/${language}${normalizedPath}` `` - this is the real route emitted by `src/pages/[locale]/[[...path]].tsx` and produced by the middleware's subdomain rewrite - and call `res.revalidate` with that value, not the public-facing locale-free path and not any other rewritten alias.

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
npm run start
```

Then:

1. Load a public route.
2. Change and publish its Sitecore content.
3. Reload and observe the cached old output.
4. POST the exact path to the revalidation endpoint.
5. Reload and observe the new output.
6. Repeat the POST with `/member/page-1` and confirm rejection.

## Scaling note

A single Next.js instance is sufficient for the POC. Multiple instances require a shared cache or an invalidation strategy that reaches each instance. Record that as a production follow-up, not a POC feature.

