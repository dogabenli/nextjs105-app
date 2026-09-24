# Sitecore JSS Next.js Sample Application

<!---
@TODO: Update to next version docs before release
-->
[Documentation (Experience Platform)](https://doc.sitecore.com/xp/en/developers/hd/22/sitecore-headless-development/sitecore-javascript-rendering-sdk--jss--for-next-js.html)

> **Note:** JSS 23 supports Sitecore XP 10.5. Sitecore AI is not supported - use [Sitecore Content SDK](https://doc.sitecore.com/sai/en/developers/content-sdk/sitecore-content-sdk-for-sitecoreai.html) for that scenario.


# Sitecore JSS member-area POC

This folder is an implementation runbook for a small proof of concept that demonstrates:

- on-demand ISR for public Sitecore routes;
- SSR for `/member` and every route below it;
- Auth0 Universal Login with a few test users;
- server-side access-token handling in the Next.js JSS app;
- request-scoped Sitecore virtual users mapped to Sitecore roles;
- Sitecore item security as the final authorization decision.

## Assumptions

- Sitecore XP 10.5 on .NET Framework 4.8.
- Sitecore JSS 23 and its Pages Router starter.
- The protected content root is `/sitecore/content/<tenant>/<site>/Home/member`.
- Public pages remain in the existing optional catch-all route.
- The Next.js runtime is Node.js, not static export.
- This is a POC. It is not a production identity platform.

If the actual solution uses a different Sitecore or JSS version, keep the architecture but verify SDK APIs and NuGet package compatibility before implementing.

## Recommended reading order

1. [01-architecture.md](docs/member-poc/01-architecture.md)
2. [02-milestones.md](docs/member-poc/02-milestones.md)
3. [03-auth0-setup.md](docs/member-poc/03-auth0-setup.md)
4. [04-sitecore-security.md](docs/member-poc/04-sitecore-security.md)
5. [05-nextjs-hybrid-rendering.md](docs/member-poc/05-nextjs-hybrid-rendering.md)
6. [06-sitecore-dotnet-authentication.md](docs/member-poc/06-sitecore-dotnet-authentication.md)
7. [07-on-demand-isr.md](docs/member-poc/07-on-demand-isr.md)
8. [08-test-plan.md](docs/member-poc/08-test-plan.md)
9. [09-copilot-runbook.md](docs/member-poc/09-copilot-runbook.md)
10. [10-decisions-and-non-goals.md](docs/member-poc/10-decisions-and-non-goals.md)

## POC success criteria

- A public page is statically generated and changes only after its exact route is revalidated.
- `/member`, `/member/page-1`, `/member/page-2`, and `/member/page-3` execute SSR on every request.
- An unauthenticated request to a member URL is redirected to Auth0 and returns to the requested URL after login.
- A basic member can read only content allowed to `extranet\\Member Basic`.
- A premium member can read content allowed to `extranet\\Member Premium`.
- A valid Auth0 user with no mapped role receives `403`, not member content.
- A forged, expired, wrong-audience, or missing token never receives protected Layout Service data.
- The access token is never placed in page props, browser storage, logs, or rendered HTML.

## Intended solution shape

Do not create a separate user database or a large standalone identity API. For this POC, the .NET backend is a small Sitecore CD extension. It validates Auth0 bearer tokens before Layout Service resolves protected content, creates a transient Sitecore virtual user, adds mapped roles, and disposes that user context after the request.

The Next.js server keeps the Auth0 session in an encrypted HTTP-only cookie. Only SSR server code obtains the access token and forwards it to Sitecore. Public ISR requests use the normal anonymous Layout Service client.

## Working method in VS Code

Complete one milestone at a time. Give Copilot only the relevant document plus the current repository files. Require it to show a plan and proposed file list before editing. Build and run the milestone-specific tests before continuing.

The repository-level instructions for Copilot are in [.github/copilot-instructions.md](.github/copilot-instructions.md).

## Reference documentation

- [Sitecore hybrid rendering](https://doc.sitecore.com/xp/en/developers/hd/22/sitecore-headless-development/switch-the-pre-rendering-method-in-a-jss-next-js-app.html)
- [Sitecore REST Layout Service](https://doc.sitecore.com/xp/en/developers/hd/22/sitecore-headless-development/fetch-layout-data-with-the-jss-rest-layout-service.html)
- [Next.js Pages Router ISR](https://nextjs.org/docs/member-poc/14/pages/building-your-application/data-fetching/incremental-static-regeneration)
- [Auth0 Next.js quickstart](https://auth0.com/docs/member-poc/quickstart/webapp/nextjs)
- [Sitecore authentication and virtual users](https://doc.sitecore.com/xp/en/developers/92/platform-administration-and-architecture/authentication-and-authorization.html)

