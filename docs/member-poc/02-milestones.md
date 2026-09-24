# Milestones

Each milestone should be a small pull request or local commit. Do not begin the next milestone until the acceptance checks pass.

## Milestone 0. Baseline and inventory

Goal: prove the existing JSS app and Sitecore route work before authentication changes.

Tasks:

1. Record exact versions from `package.json`, `node --version`, Sitecore `/sitecore/admin/showconfig.aspx`, and the .NET project.
2. Confirm the Sitecore tree contains `Home/member` and its three sample children.
3. Confirm anonymous Layout Service can read a public page.
4. Confirm the existing JSS app builds and renders a public page.
5. Add a temporary server-side render marker or response header for later verification.

Acceptance:

- Existing public page renders locally.
- The starting build is green.
- Actual version differences are documented.

## Milestone 1. Sitecore roles and ACLs

Goal: express authorization in Sitecore before integrating Auth0.

Tasks:

1. Create `extranet\\Extranet 1` and `extranet\\Extranet 2` (already created in Sitecore), and a shared base role `extranet\\Base Extranet` that both are members of.
2. Make both `extranet\\Extranet 1` and `extranet\\Extranet 2` members of the base `extranet\\Base Extranet` role - do not make one inherit the other directly.
3. Deny anonymous read on `Home/member`.
4. Grant the base `extranet\\Base Extranet` role read on the member root and intended child pages.
5. Restrict a selected child, preferably `page-3`, with an explicit read grant for `extranet\\Extranet 2` only, so basic (`extranet\\Extranet 1`) members cannot read it.
6. Verify rights in Access Viewer.

Acceptance:

- Anonymous cannot read the member root.
- Basic can read page 1 and page 2 but not premium page 3.
- Premium can read all three.

## Milestone 2. Auth0 tenant and users

Goal: obtain access tokens with a stable audience and namespaced roles claim.

Tasks:

1. Create a Regular Web Application for Next.js.
2. Create an API with an identifier such as `https://sitecore-member-poc-api`.
3. Create Auth0 roles `member-basic` and `member-premium` (these map to the existing Sitecore roles `extranet\\Extranet 1` and `extranet\\Extranet 2`).
4. Create three database users: basic, premium, and no-role.
5. Add a Post Login Action that copies assigned Auth0 roles to a namespaced access-token claim.
6. Inspect a token and verify issuer, audience, subject, expiry, and roles claim.

Acceptance:

- All three users can authenticate.
- Basic and premium access tokens contain only their expected role.
- The no-role user has no accepted role.

## Milestone 3. Next.js login and session

Goal: add login without changing rendering yet.

Tasks:

1. Install an Auth0 Next.js SDK version compatible with the detected Next.js Pages Router version. Pin it.
2. Add login, callback, logout, and profile/session routes using Pages Router APIs.
3. Add server-rendered login/logout controls to the header.
4. Request the configured API audience and `openid profile email` scopes.
5. Keep the access token server-only.

Acceptance:

- Login and logout work.
- Callback returns to a safe local URL.
- User name can be displayed from the session on public pages.
- No access token appears in the browser storage, page props, HTML, or logs.

## Milestone 4. Hybrid Next.js routes

Goal: make public routes static and member routes server-rendered.

Tasks:

1. Preserve `src/pages/[locale]/[[...path]].tsx` as the SSG public catch-all (already implemented per the domain-based i18n POC).
2. Add `src/pages/[locale]/member/[[...path]].tsx` with `getServerSideProps`, nested under the same `[locale]` segment.
3. Reuse `SitecorePagePropsFactory` and the starter page component. Read locale from `context.params.locale`, the same way `normal-mode.ts` does for the public route.
4. Convert the member route path back to `/member/...` before fetching Sitecore layout, using `context.params.path` (locale is a separate param and must not be included in the Sitecore path).
5. Redirect unauthenticated requests to login with a validated, locale-prefix-stripped `returnTo` value so the browser stays on its clean subdomain-based URL (no `/da/...` segment leaks into the address bar).
6. Send `Cache-Control: private, no-store` on member responses.
7. No additional middleware change is required: the existing `proxy.ts` matcher already rewrites `/member` requests to `/<locale>/member/...` the same way it does for public paths.

Acceptance:

- Public routes execute `getStaticProps`.
- Member routes execute `getServerSideProps` on every request.
- No member route is emitted as a static artifact.

## Milestone 5. Sitecore Auth0 adapter and virtual users

Goal: make Layout Service evaluate item security using Auth0 identity.

Tasks:

1. Add a small .NET Framework 4.8 Sitecore module on CD.
2. Run it early enough in the OWIN request pipeline to cover Layout Service.
3. Apply it only to the configured Layout Service route and protected content paths.
4. Validate JWT signature, issuer, audience, and lifetime using Auth0 discovery/JWKS.
5. Map the namespaced role claim through an allowlist.
6. Create a request-scoped virtual user in the `extranet` domain.
7. Add mapped Sitecore roles and run the remaining request inside a disposable user switcher.
8. Return `401` for an invalid token and `403` for a valid user with no mapped member role.

Acceptance:

- Direct anonymous Layout Service access to `/member` does not return protected content.
- A basic bearer token receives only basic content.
- A premium token receives premium content.
- The Sitecore context returns to anonymous after the request.

## Milestone 6. Authenticated member layout client

Goal: connect member SSR to the secured Layout Service request.

Tasks:

1. Add a member-only layout data fetcher or client that accepts a token only in server code.
2. Obtain the access token inside `getServerSideProps`.
3. Add `Authorization: Bearer <token>` to the Sitecore request.
4. Convert Sitecore `401`, `403`, and not-found responses into distinct Next.js outcomes.
5. Ensure the normal public layout client never receives the token.

Acceptance:

- End-to-end basic and premium scenarios pass.
- Browser network inspection shows no client-to-Sitecore bearer request.
- Member HTML is not cached publicly.

## Milestone 7. On-demand ISR

Goal: update public pages without rebuilding and prohibit member revalidation.

Tasks:

1. Add a POST-only `/api/revalidate` route protected by a secret header.
2. Accept a single canonical public path.
3. Normalize locale and path.
4. Reject path traversal, absolute URLs, query strings if unsupported, and `/member` or descendants.
5. Call `res.revalidate(exactPath)`.
6. Trigger it manually first, then optionally from a Sitecore publish handler or webhook.

Acceptance:

- A published public content change remains stale before revalidation.
- Calling the endpoint refreshes the exact page.
- Revalidation of `/member`, encoded variants, or malformed paths is rejected.

## Milestone 8. Evidence and demo

Goal: make the POC repeatable for reviewers.

Tasks:

1. Execute the complete test matrix.
2. Capture headers or logs proving SSG/ISR versus SSR, without secrets.
3. Document Auth0 users by persona, not by passwords.
4. Add a five-minute demo script.
5. Record POC limitations and production decisions.

Acceptance:

- Another developer can run the demo using only repository documentation and environment values.
- Every success criterion in the root README is evidenced.

