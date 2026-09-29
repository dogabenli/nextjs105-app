# Member Layout Service Authentication Handoff

## Status (2026-09-25, end of session — handing off, investigation paused)

Progress so far, in order:

1. **500 crash fixed.** `RegisterAuth0LayoutServiceMiddleware` was patched into `owin.initialize`
   with `patch:after="processor[@method='PostResolveCache']"`. Setting `IOwinContext.Request.User`
   is only valid inside the "Authenticate" stage window (see
   `App_Config/Sitecore/Owin.Authentication/Sitecore.Owin.Activation.config`, whose own comments
   say middlewares that touch `Request.User` must be patched before the `Authenticate`
   StageMarker processor). Fixed by changing the patch in
   `sitecore/Sitecore.MemberAuth/App_Config/Include/Feature/MemberAuth/Sitecore.MemberAuth.config`
   to `patch:before="processor[@method='Authenticate']"`. This eliminated the
   `Sitecore.Owin.Extensions.AppBuilderExtensions.AssertStageMarker` `NullReferenceException`
   (confirmed reproducibly gone across most requests; it reappeared once, intermittently, on a
   first request right after an app-pool recycle — not yet understood, possibly a cold-start
   race, not re-investigated).

2. **Still blocked: persistent 401 from Layout Service, despite everything we control looking
   correct.** After the crash fix, `/sitecore/api/layout/render/jss` reliably returns HTTP 401
   with an **empty body**, reason phrase `Unauthorized`, and an **empty** `WWW-Authenticate`
   header — even though, by the time our middleware's `Next.Invoke()` call returns:
   - `Sitecore.Context.User.IsAuthenticated == true`
   - `Sitecore.Context.User.Name == extranet\auth0_<hash>` (the expected virtual user)
   - the virtual user has exactly 1 mapped role attached (`user.Roles.Count == 1`)
   - the raw `((IPrincipal)user).Identity.IsAuthenticated == true` (though
     `Identity.AuthenticationType == ""`, empty string — not yet ruled out as relevant)

   Two hypotheses were tested and **both disproved**:
   - *`context.Authentication.User` is a separate property from `context.Request.User` that
     Layout Service's `[Authorize]` gate reads.* **Disproved:** in this Katana/Sitecore.Owin
     version they share the same backing store — setting `Authentication.User` after
     `Request.User` overwrote our virtual user with the raw ClaimsPrincipal and
     `Sitecore.Context.User` reverted to Anonymous. Reverted this change.
   - *Sitecore's own Identity-Server JWT bearer middleware (registered in
     `App_Config/Sitecore/Owin.Authentication.IdentityServer/Sitecore.Owin.Authentication.IdentityServer.config`,
     `patch:before="processor[@method='Authenticate']"`, same stage window as our middleware)
     re-validates the raw `Authorization` header against Sitecore's own Identity Server and
     rejects it.* Tried removing the `Authorization` header before `Next.Invoke()` (restored in
     `finally`) so that middleware would see no bearer token at all. **Did not fix it** — same
     401/empty-body/empty-header symptom persisted with the header removed.
   - *Virtual user's raw identity isn't "authenticated" per .NET semantics
     (`GenericIdentity.IsAuthenticated` is false when `AuthenticationType` is empty), which is
     what ASP.NET/OWIN's own authorization gate would check instead of
     `Sitecore.Context.User.IsAuthenticated`.* **Disproved:** logged directly —
     `identity.IsAuthenticated == True` despite `AuthenticationType == ''`. Sitecore's `User`
     class evidently doesn't use a plain `GenericIdentity` with the usual empty-string semantics.

   The empty response body + empty `WWW-Authenticate` + generic "Unauthorized" reason phrase is
   most consistent with either (a) an OWIN authentication middleware's automatic challenge
   (`AutomaticMode`/`AutomaticChallenge`, which typically just sets `StatusCode = 401` with no
   body in `OnSendingHeaders`, independent of `Sitecore.Context.User`), or (b) an IIS/ASP.NET
   host-level 401 unrelated to any Sitecore/OWIN application code at all. Neither has been
   directly confirmed. The stack trace captured earlier (from the 500 crash, before it was fixed)
   showed the request passing through **multiple** `Microsoft.Owin.Security.Infrastructure.AuthenticationMiddleware`
   instances plus `IdentityFactoryMiddleware`, `Map`/`MapWhen` — i.e. there is more than one
   authentication-related OWIN middleware registered in this pipeline (at least our own, plus
   Sitecore's cookie auth, plus Sitecore's Identity-Server JWT bearer auth), any of which could be
   the actual source of the automatic 401 challenge.

## Temporary diagnostics currently deployed (must be removed once resolved)

In `sitecore/Sitecore.MemberAuth/Auth0LayoutServiceMiddleware.cs`:
- Logs bearer-header presence, token-validation failures, virtual-user role count.
- Logs `identity.IsAuthenticated` / `identity.AuthenticationType` right after building the
  virtual user.
- Wraps `context.Response.Body` in a `MemoryStream` around `Next.Invoke()` to capture and log the
  response status code, reason phrase, `WWW-Authenticate` header, and body text (truncated to
  1000 chars), then copies it back to the real response stream. Currently the captured body is
  always empty for the 401 case.
- Removes the `Authorization` header before `Next.Invoke()` (restored in `finally`) — this did
  not fix the 401 and could arguably be reverted, but is currently left in since it did not appear
  to cause any regression either (see "both disproved" above).

None of these log token values, secrets, or full claim sets — only booleans, counts, hashed
usernames, and generic HTTP metadata.

## Recommended next investigation (not yet started)

1. Determine definitively **which OWIN middleware instance** is producing the 401. Options,
   roughly in order of effort:
   - Temporarily disable/comment out the `JwtBearerAuthentication` processor registration in
     `Sitecore.Owin.Authentication.IdentityServer.config` (or patch it to
     `enabled="false"`/remove it via a local override) and retest — if the 401 disappears (or
     changes shape), that middleware is the culprit.
   - Temporarily disable `CookieAuthentication` / `PreviewCookieAuthentication` /
     `ExternalCookieAuthentication` processors the same way, one at a time.
   - Check IIS logs / `Failed Request Tracing` (if enabled) for this specific request to see the
     exact module/handler that set the 401, which would settle this without further guessing.
2. If it turns out to be Sitecore's own `JwtBearerAuthentication`/Identity-Server middleware:
   research whether it can be scoped away from `/sitecore/api/layout/render/jss` specifically
   (e.g. via `MapWhen` exclusion, or an `enabled`/path-filter setting), rather than disabling it
   globally (which would break real Sitecore Identity Server logins).
3. Re-check whether `AuthenticationMode` (Active vs Passive) matters here — Katana authentication
   middlewares only run their `AuthenticateCoreAsync`/challenge logic under specific conditions
   depending on this setting, and Sitecore's own middleware registrations may default to
   `Active`, meaning they act on every request regardless of path, unless explicitly scoped.
4. Once the actual 401 source is confirmed, decide the real fix: either exclude/reconfigure that
   middleware for this route, or find the correct Sitecore-supported extension point for
   layering an additional (Auth0) identity provider into Sitecore's own federated-authentication
   pipeline (`federatedAuthentication/identityProviders` in
   `Sitecore.Owin.Authentication.IdentityServer.config` shows the shape of this: a custom
   `identityProvider` with claim `transformations`) instead of a raw custom OWIN middleware. This
   may be the more "supported" long-term direction if the raw-middleware approach keeps hitting
   Sitecore's own built-in auth machinery.
5. Remove all temporary diagnostics (see list above) once the actual fix is found and verified,
   per the "Definition of done" in `.github/copilot-instructions.md`.

## Resolution history (superseded diagnosis attempts, kept for context)

Root cause of the **500 crash** (now fixed, see Status above): `Sitecore.MemberAuth.RegisterAuth0LayoutServiceMiddleware` was patched into
the `owin.initialize` pipeline with `patch:after="processor[@method='PostResolveCache']"`.
Sitecore's `owin.initialize` pipeline is built from `Sitecore.Owin.Pipelines.Initialize.StageMarker`
processors that call `app.UseStageMarker(PipelineStage.X)` between middleware registrations
(see `App_Config/Sitecore/Owin.Authentication/Sitecore.Owin.Activation.config`, whose own
comments state: "a processor that contains such a middleware should be patched before the
Authenticate StageMarker processor"). Setting `IOwinContext.Request.User` is only valid while
the pipeline is within the "Authenticate" stage window. Because our middleware ran after
`PostResolveCache` (a later stage), `Sitecore.Owin.Extensions.AppBuilderExtensions.AssertStageMarker`
threw `NullReferenceException` when `context.Request.User = user;` executed.

Fix applied:
- `sitecore/Sitecore.MemberAuth/App_Config/Include/Feature/MemberAuth/Sitecore.MemberAuth.config`:
  changed the `owin.initialize` patch to `patch:before="processor[@method='Authenticate']"`.
- `sitecore/Sitecore.MemberAuth/Auth0LayoutServiceMiddleware.cs`: kept the original
  `context.Request.User = user` try/finally pattern (this was correct all along; the position in
  the pipeline was the bug, not the mechanism). Note: `Sitecore.Context.User` has no public
  setter in Sitecore 10.5, so that is not a viable alternative.

Module was rebuilt, the config and DLL were redeployed to
`C:\inetpub\wwwroot\nextjs-105xpsc.dev.local`, and the app pool was recycled.

## Summary

The Next.js member SSR route now obtains an Auth0 access token and sends it to Sitecore Layout Service, but the authenticated member page remains unresolved. The original 404 was caused by protected Layout Service authentication failures being normalized to `notFound`. JWT validation now succeeds, but attempts to establish the Sitecore virtual user around the async Layout Service pipeline have produced either a 500 or a pending request.

The current last change has been deployed but not yet verified by a subsequent user request: the middleware uses only the OWIN request principal and restores it in `finally`.

## Repositories and Runtime

- Next.js app: `C:\ProjectsSC\nextjs-105xp\nextjs105-app`
- Sitecore module: `C:\ProjectsSC\nextjs-105xp\sitecore\Sitecore.MemberAuth`
- Sitecore CD: `https://nextjs-105xpsc.dev.local`
- Next.js development URL: `http://localhost:3000`
- Next package: `16.3.4`
- JSS package: `23.0.0`
- Auth0 SDK: `4.30.0`
- Sitecore XP: `10.5`

No secrets or raw tokens are included in this issue.

## Expected Flow

1. `src/pages/[locale]/member/[[...path]].tsx` calls `auth0.getSession(req)`.
2. It calls `auth0.getAccessToken(req, res)` server-side.
3. The page-props factory receives an internal `accessToken` option.
4. `src/lib/layout-service-factory.ts` creates a request-scoped `RestLayoutService`.
5. Authenticated requests use the Sitecore `jss` configuration:

   `/sitecore/api/layout/render/jss`

6. The request sends `Authorization: Bearer <server-side-token>` and preserves the Sitecore API key/query parameters.
7. Sitecore validates the JWT, maps `member-basic` or `member-premium`, creates a virtual user, evaluates ACLs, and runs Layout Service.

Public pages must remain on the existing SSG/ISR path and must not receive a bearer token.

## Verified Facts

- `/api/auth-debug` reports the expected Auth0 audience, subject, and `member-basic` role.
- Auth0 discovery and JWKS endpoints are reachable from the development machine.
- Sitecore merged configuration contains:
  - Authority: `https://dev-blimome4usawppx7.us.auth0.com/`
  - Audience: `https://sitecore-member-poc-api`
  - Roles claim: `https://sitecore-member-poc.example/roles`
  - Layout Service path: `/sitecore/api/layout/render/jss`
  - Protected root: `/member`
  - Role mappings: `member-basic=extranet\\Extranet 1|member-premium=extranet\\Extranet 2`
- The Next.js authenticated fetcher was tested and confirmed to target `/sitecore/api/layout/render/jss`.
- A direct fake bearer request reached Sitecore middleware and produced a safe `SecurityTokenMalformedException`, proving the Authorization header reaches Sitecore.
- Authenticated requests reached Sitecore with `bearer header present: True`.
- `MapInboundClaims = false` was added to preserve the JWT `sub` and namespaced roles claims. After this change, the prior validation failure stopped occurring.

## Original Failure

Next.js logged:

```text
member_layout_service_request_started
member_layout_service_request_failed 401
member_layout_authentication_failed
GET /member/page-1 404
```

The 404 was a deliberate fail-closed result from the Next.js member route, not a missing browser route.

## Root Causes Already Found

### 1. Wrong Layout Service configuration

The authenticated client originally used `config.layoutServiceConfigurationName`, which resolved to `default`:

```text
/sitecore/api/layout/render/default
```

The Sitecore middleware protects only:

```text
/sitecore/api/layout/render/jss
```

The authenticated client was changed to use `configurationName: 'jss'`. Tests now assert the `/render/jss` URL.

### 2. JWT claim mapping

`JwtSecurityTokenHandler` was remapping claims, causing the final `principal.FindFirst("sub")` check to fail despite the token containing `sub`. The validator now uses:

```csharp
var tokenHandler = new JwtSecurityTokenHandler { MapInboundClaims = false };
```

### 3. UserSwitcher async lifetime failure

The original implementation used:

```csharp
using (new UserSwitcher(user))
{
    await Next.Invoke(context).ConfigureAwait(false);
}
```

Sitecore later logged:

```text
System.InvalidOperationException: Stack is null or empty
at Sitecore.Common.Switcher<T>.Dispose()
at Sitecore.MemberAuth.Auth0LayoutServiceMiddleware.<Invoke>d__5.MoveNext()
```

A synchronous `.GetAwaiter().GetResult()` workaround caused the browser request to remain pending, so it was reverted.

### 4. ASP.NET principal substitution caused OWIN stage failure

The next attempt set both `context.Request.User` and `HttpContext.User`. Sitecore then logged:

```text
System.NullReferenceException
Source: Sitecore.Owin
at Sitecore.Owin.Extensions.AppBuilderExtensions.AssertStageMarker
at Sitecore.MemberAuth.Auth0LayoutServiceMiddleware.Invoke
```

Setting only `HttpContext.User` produced the same stage-marker failure.

## Current Unverified Attempt

The latest source implementation sets only the OWIN request principal and restores it asynchronously:

```csharp
var originalRequestUser = context.Request.User;
try
{
    context.Request.User = user;
    await Next.Invoke(context).ConfigureAwait(false);
}
finally
{
    context.Request.User = originalRequestUser;
}
```

The module was rebuilt, copied to:

```text
C:\inetpub\wwwroot\nextjs-105xpsc.dev.local\bin\Sitecore.MemberAuth.dll
```

and the IIS app pool `nextjs-105xpsc.dev.local` was recycled.

This latest attempt has not yet been validated by a fresh browser request. The next model should first test this exact version before changing more architecture.

## Temporary Diagnostics Still Present

The following temporary safe diagnostics are still present and must be removed after diagnosis:

- `src/lib/layout-service-factory.ts` logs `member_layout_target` and `member_layout_status` without logging URLs, tokens, API keys, cookies, or bodies.
- `sitecore/Sitecore.MemberAuth/Auth0LayoutServiceMiddleware.cs` logs bearer presence and validator exception type only.

Do not retain raw-token logging or add it.

## Relevant Files

- `src/pages/[locale]/member/[[...path]].tsx`
- `src/lib/layout-service-factory.ts`
- `src/lib/page-props-factory/index.ts`
- `src/lib/page-props-factory/plugins/normal-mode.ts`
- `src/lib/layout-service-factory.test.ts`
- `src/lib/member-page.test.ts`
- `sitecore/Sitecore.MemberAuth/Auth0LayoutServiceMiddleware.cs`
- `sitecore/Sitecore.MemberAuth/Auth0TokenValidator.cs`
- `sitecore/Sitecore.MemberAuth/Auth0RoleMapper.cs`
- `sitecore/Sitecore.MemberAuth/App_Config/Include/Feature/MemberAuth/Sitecore.MemberAuth.config`

## Validation Already Passing

- Focused Vitest suite: 8 tests passed.
- Full Vitest suite before the latest Sitecore-only changes: 32 tests passed.
- Next.js TypeScript check passed before the latest Sitecore-only changes.
- Sitecore module builds successfully with existing assembly-version warnings.
- Production Next.js build passed previously.
- Public catch-all remained SSG/ISR.
- Member catch-all remained dynamic SSR.

## Recommended Next Investigation

1. Refresh `/member/page-1` once with the latest OWIN-only build.
2. Read the newest Sitecore log entry and the Next.js diagnostic output.
3. If the OWIN-only approach still causes `AssertStageMarker` failure, inspect Sitecore 10.5's supported request-user mechanism rather than trying more combinations of `HttpContext.User` and `context.Request.User`.
4. Inspect the Sitecore `UserSwitcher`/`Switcher<T>` implementation and its request/thread storage. The core problem is preserving a Sitecore virtual user across an awaited OWIN pipeline without corrupting Sitecore's switcher stack.
5. Confirm whether Sitecore's supported async pattern is a request-scoped OWIN environment principal, an authentication middleware identity, or a Sitecore-specific request context API.
6. After a successful request, remove all temporary diagnostics and verify:
   - basic page 1 and 2 render;
   - basic page 3 has no premium content;
   - premium page 3 renders for premium users;
   - anonymous requests remain 401/redirected;
   - Sitecore user context is anonymous after the request;
   - public SSG behavior is unchanged.
