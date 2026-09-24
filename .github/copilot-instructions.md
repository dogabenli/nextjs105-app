# Copilot instructions for the member-area POC

## Scope

Implement only the milestone explicitly requested by the developer. Do not silently add production infrastructure, databases, refresh-token persistence, a custom user store, or generalized authorization frameworks.

## Technology constraints

- Sitecore XP 10.5 and JSS 23.
- Existing JSS Next.js Pages Router conventions must be preserved.
- Public Sitecore pages use `getStaticProps` and on-demand ISR.
- `src/pages/member/[[...path]].tsx` uses `getServerSideProps`.
- Auth0 handles login. Tokens stay server-side.
- Sitecore item security is authoritative for protected content.
- The Sitecore extension targets .NET Framework 4.8 and runs on CD.
- Use the existing solution's Sitecore assembly references and binding versions. Do not upgrade Sitecore-owned packages casually.

## Security rules

- Validate access-token signature, issuer, audience, and lifetime.
- Map external roles through an explicit allowlist. Never treat a token value as a Sitecore role name.
- Use the Auth0 `sub` claim as the immutable external identity. Sanitize or hash it when forming a Sitecore username.
- Never serialize the bearer token into React props or HTML.
- Never store access tokens in `localStorage` or `sessionStorage`.
- Never log tokens, cookies, client secrets, or full claims.
- Reject member Layout Service requests that lack a valid token.
- Reject mapped users with no permitted role.
- Restore or dispose the Sitecore user context at the end of every request.
- The revalidation endpoint must use a secret, accept only allowed methods, normalize paths, and refuse `/member` paths.

## Implementation behavior

- Reuse the starter's `SitecorePagePropsFactory`, page component, error handling, locale handling, and editing-mode behavior.
- Keep separate public and member layout-service clients if that makes token handling explicit.
- Return `302` to login when no Next.js session exists, `403` for an authenticated but unauthorized user, and `404` for a genuinely missing route.
- Add small tests around route classification, role mapping, and revalidation path validation.
- Add structured diagnostic messages without identity data or secrets.

## Before editing

1. Inspect `package.json`, `src/pages`, `src/lib/page-props-factory.ts`, `src/lib/sitecore`, and the .NET solution.
2. Report detected Next.js, JSS, Auth0 SDK, .NET Framework, and Sitecore assembly versions.
3. List the exact files to create or change.
4. Identify any mismatch with these instructions and stop for a decision if it changes the architecture.

## Definition of done for every milestone

- The relevant TypeScript or C# build passes.
- Tests for the milestone pass.
- No secret is committed.
- A short manual verification procedure is added to the milestone notes.
- Existing public routes and Experience Editor behavior are not unintentionally changed.

