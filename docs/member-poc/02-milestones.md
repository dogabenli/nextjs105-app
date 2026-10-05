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

Manual verification after local deployment:

1. Confirm the include appears in `showconfig.aspx` under `pipelines/owin.initialize` after the `PostResolveCache` processor.
2. Call `/sitecore/api/layout/render/jss?item=/member` without a bearer token and expect `401`.
3. Call the same endpoint with basic and premium bearer tokens and verify the Sitecore ACL limits each response.
4. Check the Sitecore log for startup errors, then make an anonymous request and confirm the prior user context is restored.

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

Implementation notes:

- Auth0 `AUTH0_AUDIENCE` is `https://sitecore-member-poc-api`; sessions created before
	this audience was configured must be logged out and back in.
- Member SSR calls `auth0.getAccessToken(req, res)` and passes the token only to a
	request-scoped REST fetcher. The fetcher sends the bearer header and no browser cookies.
- Sitecore 401 and unreadable routes fail closed through the existing not-found result;
	Sitecore 403 redirects to the controlled `/403` page. All member responses set
	`Cache-Control: private, no-store`.

Manual verification:

1. Log out, log in again, and confirm the Auth0 login requests the documented API audience.
2. Logged out: open `/member` and expect `/auth/login?returnTo=/member`.
3. No-role user: open `/member` and expect the controlled forbidden page.
4. Basic user: verify `/member/page-1` and `/member/page-2`; verify `/member/page-3`
	 contains no premium content.
5. Premium user: verify all three member pages, including premium `/member/page-3`.
6. While logged in, open a public page and confirm it still uses the public SSG path.
7. Inspect member responses for `Cache-Control: private, no-store`; do not inspect or log
	 raw tokens. Confirm Sitecore logs show only safe virtual-user and role diagnostics.

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

## Milestone 9. Standalone Sitecore Personalize web experience

Goal: prove that standalone Sitecore Personalize can personalize one component on a public SSG/ISR page at runtime without creating visitor-specific static output or changing member authorization.

Scope:

- Use the standalone Sitecore Engage SDK, not embedded SitecoreAI/XM Cloud personalization.
- Continue using the existing public catch-all route; do not add a dedicated Next.js route for the demo page.
- The `/personalize-demo` page is created in Sitecore and is resolved by the existing catch-all route.
- Personalize one existing `ContentBlock.tsx` rendering on that public page only.
- Keep Auth0 roles, Sitecore item security, and member pages unchanged.
- Keep the default Content Block heading and rich-text content useful when Personalize is unavailable or the visitor is not targeted.

Tasks:

1. Create `/personalize-demo` in Sitecore and add exactly one existing Content Block rendering with a datasource containing default `heading` and `content` values. No new Next.js page file or component type is required.
2. Update the root element of `ContentBlock.tsx` with a stable explicit selector such as `data-personalize-slot="content-block"`. Preserve the existing `contentBlock`, `contentTitle`, and `contentDescription` classes and the existing `Text`, `RichText`, and `withDatasourceCheck` behavior. Do not target generated CSS classes or placeholder positions. Because the POC page contains exactly one Content Block, the Web Experience may target this stable root selector on that page; document that a production page with multiple Content Blocks would require a unique rendering-level identifier.
3. Install and pin `@sitecore/engage`. Treat compatibility with the current Next.js 16.2 Pages Router application as an explicit spike because the current Sitecore walkthrough documents testing only through Next.js 14.2.5.
4. Add typed configuration for `NEXT_PUBLIC_PERSONALIZE_ENABLED`, `NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY`, `NEXT_PUBLIC_PERSONALIZE_TARGET_URL`, `NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE`, `NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN`, `NEXT_PUBLIC_PERSONALIZE_CHANNEL`, and `NEXT_PUBLIC_PERSONALIZE_CURRENCY`. Derive the VIEW-event language from the active public locale. Update `.env.example` without adding real values.
5. Add an application-level Engage provider and mount it once from `src/pages/_app.tsx`. Do not initialize Engage inside `ContentBlock.tsx` or on every render.
6. For this POC, use client-set Personalize cookies with `forceServerCookieMode: false` so the existing locale/authentication proxy remains unchanged. Record server-set cookies as a production hardening decision, not part of this milestone.
7. Initialize Engage only in the browser and only when the feature flag is enabled and consent has been granted. If the POC has no consent manager, implement a small injectable consent check and document the local demo override.
8. Enable browser-side web personalization with `webPersonalization: true`.
9. Send exactly one VIEW event after initial initialization. Use the clean browser-visible path and active language, not the internal locale-prefixed rewrite path.
10. Subscribe to the Pages Router `routeChangeComplete` event. After each completed client-side navigation, send exactly one VIEW event and call `window.Engage.triggerExperiences()` so live Web Experiences are evaluated for the new route. Remove the subscription during cleanup and avoid double-firing on the initial load.
11. Skip tracking and experience execution for `/_next`, `/api`, `/auth`, Sitecore editing/preview endpoints, and other non-page requests. Do not send Auth0 tokens, session cookies, Sitecore roles, or other security data to Personalize.
12. Add only the CSP/connect-src/script-src entries required by the configured Personalize region and document them; do not weaken the remaining policy.
13. In standalone Sitecore Personalize, create a Web Experience targeted to `/personalize-demo`. Configure one variant that changes only the heading and/or rich-text content inside `[data-personalize-slot="content-block"]`. Keep the experience idempotent so rerunning it updates the existing Content Block instead of inserting duplicate markup.
14. Use the Personalize QA/Preview tool or one simple deterministic demo condition to prove targeted versus non-targeted behavior. Do not use personalization as an authorization mechanism.
15. Verify the VIEW event in Personalize Event Viewer using the browser ID, then remove any temporary browser-ID console logging.
16. Extend the repository documentation and five-minute demo script with configuration, consent assumptions, Personalize setup, verification steps, fallback behavior, and the Next.js 16.2 compatibility result.

Acceptance:

- The public demo route is still emitted as SSG/ISR and member routes remain SSR with `Cache-Control: private, no-store`.
- The generated HTML and ISR cache contain only the default Sitecore Content Block heading and content, never a visitor-specific Personalize variant.
- A targeted browser sees the personalized Content Block after hydration; a non-targeted browser sees the default Sitecore heading and content.
- Blocking or disabling Personalize leaves the default Content Block usable and produces no unhandled application error.
- Initial load sends one VIEW event; each completed client-side route change sends one additional VIEW event with no duplicates.
- Returning to the demo page through client-side navigation reruns the Web Experience without duplicated markup.
- A Sitecore content change remains stale until the existing on-demand ISR endpoint revalidates the exact public path; after revalidation, the new default content is served and Personalize can still apply its runtime variant.
- Personalize activity never calls the revalidation endpoint and never changes the cached page per visitor.
- No Auth0 access token, authentication session value, or Sitecore security role appears in Personalize requests, browser storage added by this milestone, page props, HTML, or logs.
- The production build, TypeScript checks, existing automated tests, and new Personalize provider tests pass on the pinned dependency versions.

Suggested automated tests:

1. Engage initialization is disabled when the feature flag is false.
2. Engage initialization waits for consent.
3. Initialization occurs once even when React rerenders.
4. Initial load produces one VIEW event.
5. `routeChangeComplete` produces one VIEW event and one `triggerExperiences()` call.
6. Excluded routes do not produce Personalize calls.
7. Event handlers are removed when the provider unmounts.
8. `ContentBlock.tsx` renders its default Sitecore `heading` and `content` fields without the Engage SDK and retains `withDatasourceCheck` behavior.

Manual verification:

1. Run a production build and confirm the demo route is static while `/member` remains dynamic.
2. Request the demo page HTML directly and confirm it contains only the default Sitecore Content Block heading and content.
3. Open the page in a targeted browser and confirm the Web Experience changes only the selected Content Block.
4. Open the page in a non-targeted or clean browser and confirm the default Content Block remains.
5. Navigate away and back using Next.js client-side navigation; confirm one new VIEW event and no duplicate personalized markup.
6. Disable the feature flag or block the Personalize endpoint; confirm the default Content Block still works.
7. Change the Content Block datasource in Sitecore, publish it, verify the old static content remains, invoke the existing exact-path revalidation endpoint, and confirm the new default heading/content appears before the runtime variant is applied.