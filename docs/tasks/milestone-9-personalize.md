Implement Milestone 9, “Standalone Sitecore Personalize web experience,” from `02-milestones.md`.

Before changing code:

1. Read the root README, `02-milestones.md`, `package.json`, package lockfile, `.env.example`, the Pages Router `_app.tsx`, existing providers, `ContentBlock.tsx`, public catch-all route, member route, locale rewrite/proxy implementation, CSP configuration, test setup and demo documentation.
2. Confirm the actual repository paths and dependency versions.
3. Review Milestones 0-8 so their rendering, authentication, authorization and revalidation behaviour remains unchanged.
4. Produce a short implementation plan based on the actual repository.
5. Implement the plan unless a technical incompatibility blocks progress.
6. Do not create commits.

## Current external configuration

The following configuration has already been completed manually in standalone Sitecore Personalize:

- A Web Experience has been created.
- The experience is currently in Draft state.
- A custom Content Block personalization variant has been prepared.
- The Point of Sale `jss-poc-web` has been created.
- Page targeting has been configured with:

  ```regex
  ^http://(?:localhost|(?:en|da)\.nextjs105\.local):3000/personalize-demo/?(?:[?#].*)?$
  ```

The experience must remain in Draft until the application integration and manual browser verification are complete.

Do not attempt to create, publish, start, pause or modify the Personalize Web Experience through application code.

If the `jss-poc-web` condition has not yet been assigned to the draft experience, document that it must be selected manually in the existing Point of Sale filter.

## Scope

Implement only Milestone 9.

The application already has a public catch-all route. The `/personalize-demo` page is created manually in Sitecore and resolved by that existing catch-all route.

Do not:

- Add `pages/personalize-demo.tsx`.
- Add another catch-all route.
- Add a new promo or personalization component.
- Create Sitecore items in code.
- Create or manage the Personalize Web Experience through application code.
- Modify Auth0 authentication.
- Modify Sitecore virtual-user or role mapping.
- Modify Sitecore item-security handling.
- Modify member-page rendering.
- Modify the existing on-demand ISR endpoint.
- Modify the existing locale/authentication proxy.
- Use SitecoreAI or XM Cloud personalization.
- Use the Sitecore Cloud SDK.
- Use the legacy Boxever library.
- Add GTM as a replacement for the SDK.
- Create commits.

Use standalone Sitecore Personalize through the `@sitecore/engage` package.

## Existing ContentBlock component

The component to personalize is the existing `ContentBlock.tsx`:

```tsx
import { JSX } from 'react';
import { Text, RichText, Field, withDatasourceCheck } from '@sitecore-jss/sitecore-jss-nextjs';
import { ComponentProps } from 'lib/component-props';

type ContentBlockProps = ComponentProps & {
  fields: {
    heading: Field<string>;
    content: Field<string>;
  };
};

const ContentBlock = ({ fields }: ContentBlockProps): JSX.Element => (
  <div className="contentBlock">
    <Text tag="h2" className="contentTitle" field={fields.heading} />

    <RichText className="contentDescription" field={fields.content} />
  </div>
);

export default withDatasourceCheck()<ContentBlockProps>(ContentBlock);
```

Preserve:

- Existing field types.
- Sitecore editing support.
- The `Text` component.
- The `RichText` component.
- The `contentBlock`, `contentTitle` and `contentDescription` classes.
- `withDatasourceCheck`.
- Existing component exports and component-factory behaviour.

## ContentBlock change

Add a stable Personalize selector to the root element:

```tsx
<div
  className="contentBlock"
  data-personalize-slot="content-block"
>
```

Do not replace the existing classes or change how the Sitecore fields render.

For this controlled POC, `/personalize-demo` contains exactly one Content Block. The Web Experience can therefore target:

```css
[data-personalize-slot="content-block"]
```

Document that this selector is sufficient only because the demo page contains exactly one Content Block.

A production page containing multiple Content Blocks must use a unique rendering-level identifier, such as:

- Sitecore rendering UID.
- A configured rendering identifier.
- Another stable identifier already established by the application.

Do not introduce that production-level identifier unless the repository already has a clear pattern that can be reused without expanding the scope.

## Engage SDK integration

1. Install and pin an exact version of `@sitecore/engage`.
2. Update the package lockfile.
3. Do not use an unpinned version range.
4. Verify the current official package documentation and inspect the installed package exports and TypeScript definitions.
5. Treat compatibility with the existing Next.js 16.2 Pages Router application as an explicit compatibility spike. The existing milestone notes that the Sitecore walkthrough was tested only through Next.js 14.2.5.
6. Validate package integration with:
   - TypeScript checks.
   - Automated tests.
   - Production build.
   - Browser-only initialization assumptions.
7. If the package is demonstrably incompatible with Next.js 16.2, stop and report:
   - The exact error.
   - The command that produced it.
   - The relevant package and framework versions.
   - Whether the failure occurs during installation, type checking, testing, bundling or runtime initialization.
8. Do not silently replace the package with GTM, a CDN script, the Cloud SDK or another library.

## Configuration

Add typed configuration for:

```env
NEXT_PUBLIC_PERSONALIZE_ENABLED=
NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY=
NEXT_PUBLIC_PERSONALIZE_TARGET_URL=
NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE=
NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN=
NEXT_PUBLIC_PERSONALIZE_CHANNEL=
NEXT_PUBLIC_PERSONALIZE_CURRENCY=
```

Update `.env.example` with placeholders only. Do not add a real client key or other environment-specific tenant values.

Document the POC configuration example separately:

```env
NEXT_PUBLIC_PERSONALIZE_ENABLED=true
NEXT_PUBLIC_PERSONALIZE_CLIENT_KEY=<personalize-client-key>
NEXT_PUBLIC_PERSONALIZE_TARGET_URL=<regional-engage-endpoint>
NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE=jss-poc-web
NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN=nextjs105.local
NEXT_PUBLIC_PERSONALIZE_CHANNEL=WEB
NEXT_PUBLIC_PERSONALIZE_CURRENCY=EUR
```

Do not commit the real client key.

Validate configuration before initializing Engage. Treat configuration as incomplete when any required setting is missing or invalid.

The application must remain functional when configuration is incomplete.

## Local hosts and cookie domain

The preferred browser hosts for the POC are:

```text
http://en.nextjs105.local:3000
http://da.nextjs105.local:3000
```

For those language subdomains, the intended cookie domain is:

```text
nextjs105.local
```

A cookie scoped to `nextjs105.local` cannot also be used by `localhost`.

Therefore:

- Use `en.nextjs105.local` and `da.nextjs105.local` for final Personalize QA and browser testing.
- Document that `localhost:3000` cannot share the `nextjs105.local` Personalize cookie.
- Do not add custom multi-domain cookie logic solely to support both `localhost` and the custom local domains.
- Do not weaken cookie configuration to work around this local-development limitation.
- The page-targeting regex may continue to contain `localhost`, but the final test should use the language-specific hosts.

## Provider architecture

1. Add an application-level Engage provider.
2. Mount it once from the existing Pages Router `_app.tsx`.
3. Initialize Engage only in the browser.
4. Do not initialize Engage during SSG, ISR, SSR or module import.
5. Do not initialize Engage from `ContentBlock.tsx`.
6. Do not make `ContentBlock.tsx` depend on the provider.
7. Initialize Engage only once across React rerenders.
8. Account for React development behaviour that can run effects more than once.
9. Catch initialization errors and avoid unhandled promise rejections.
10. Clean up router event subscriptions when the provider unmounts.

Disable the integration safely when:

- `NEXT_PUBLIC_PERSONALIZE_ENABLED` is not `true`.
- Configuration is incomplete.
- Code is executing server-side.
- Consent has not been granted.
- The current route is ineligible.
- Engage initialization fails.

Use client-set cookies for this POC:

```ts
forceServerCookieMode: false
```

Enable Web Experiences:

```ts
webPersonalization: true
```

Record server-set cookies as a separate production hardening decision. Do not implement server-set cookies in this milestone.

## Engage SDK instance

Use the actual API and TypeScript definitions exposed by the pinned `@sitecore/engage` package.

- Retain the Engage client returned by initialization.
- Do not blindly assume that `window.Engage` exists.
- Do not assume the casing or methods of the script-based global API match the NPM package.
- Inspect the installed package exports and types.
- Invoke `triggerExperiences()` through the API supported by the installed package.
- Only expose the initialized client on `window` if package-based Web Experience execution requires it.
- If a window global is required, add a narrow TypeScript declaration and assign the initialized client exactly once.
- Do not create competing package-client and script-global instances.
- Document the actual API shape used and any difference from script-based documentation.

## Consent

Inspect whether the application already has a consent manager.

If a consent manager exists:

- Reuse its established consent state and subscription mechanism.
- Do not create a second consent store.
- Initialize Engage only after the relevant analytics/personalization consent has been granted.

If no consent manager exists:

- Add a small injectable consent-check abstraction for the POC.
- Default it to no consent.
- Document a local demo override.
- Keep the override clearly separated from production consent.
- Do not permanently hardcode consent as granted.
- Do not present the POC override as a production consent solution.

## VIEW events

Send exactly one VIEW event after successful initial Engage initialization.

Populate it only with the required public-page information:

- Configured channel.
- Configured currency.
- Configured Point of Sale.
- Active public language.
- Clean browser-visible page path.

Use:

```text
jss-poc-web
```

as the Point of Sale through configuration. Do not hardcode it inside the event implementation.

The application uses domain-based languages and an internal locale rewrite.

The VIEW event must use the clean browser-visible path. It must not send the internal locale-prefixed route produced by the rewrite.

For example, the event should represent:

```text
/personalize-demo
```

and not an internal route such as:

```text
/en/personalize-demo
```

Inspect the existing locale implementation and derive the language from its established source of truth.

Do not infer the event language independently if the application already provides it.

Prevent duplicate VIEW events for the same completed navigation.

## Client-side navigation

Subscribe to the Pages Router `routeChangeComplete` event.

After each eligible completed client-side navigation:

1. Send exactly one VIEW event.
2. Invoke `triggerExperiences()` using the actual API supported by the initialized Engage package client.
3. Prevent duplicate VIEW events.
4. Prevent double execution on initial application load.
5. Remove the route event listener during provider cleanup.

Do not hardcode the following unless it matches the installed package API:

```ts
window.Engage.triggerExperiences();
```

Instead, use the initialized package client and its verified API. If the SDK requires a browser global for Web Experiences, expose and use that global once with a narrow type declaration.

## Route eligibility

Exclude technical and protected routes, including:

```text
/_next
/api
/auth
/member
```

Also inspect the repository for:

- Sitecore editing routes.
- Sitecore preview routes.
- Debug routes.
- Health-check routes.
- Other internal or non-page endpoints.

Do not initialize Personalize, send VIEW events or execute Web Experiences on member routes.

Personalize may still run on eligible public pages when the visitor is logged in. Login state must not be sent to Personalize as part of this milestone.

## Security boundaries

Never send any of the following to Personalize:

- Auth0 access tokens.
- Auth0 ID tokens.
- Authentication cookies.
- Session values.
- Authorization headers.
- Auth0 subject identifiers.
- Sitecore virtual-user names.
- Auth0 roles.
- Sitecore security roles.
- Revalidation secrets.
- Protected Layout Service responses.
- Member-page content.
- Server-only environment values.
- Raw application error details containing sensitive data.

Do not use Personalize as an authentication or authorization mechanism.

Milestone 9 applies only to the public Content Block on the public Sitecore page.

Public routes must remain SSG/ISR.

Member routes must remain SSR with:

```http
Cache-Control: private, no-store
```

Personalize must not affect Sitecore item-security evaluation or member-route authorization.

## Failure behaviour

The default Sitecore Content Block must remain fully functional when:

- Personalize is disabled.
- Consent is missing.
- Configuration is incomplete.
- Engage initialization fails.
- Personalize requests are blocked.
- The browser blocks cookies.
- No experience targets the visitor.
- The draft experience is not live.
- JavaScript is unavailable.
- The current route is excluded.

Catch Personalize errors without causing unhandled promise rejections.

Log only safe diagnostic information.

Do not log:

- Client keys.
- Browser IDs in production.
- Authentication/session values.
- Tokens.
- Security roles.
- Complete SDK request payloads that might later contain identifiers.

## CSP

Inspect the existing Content Security Policy.

Determine the minimum `script-src` and `connect-src` origins required by:

- The configured regional Engage target URL.
- Any web-personalization script loaded by the package.
- The exact pinned SDK integration.

Add only the minimum required origins.

Do not:

- Add broad wildcards without evidence.
- Add `unsafe-eval`.
- Weaken unrelated directives.
- Replace the existing CSP wholesale.

If CSP is externally managed or the repository has no safe configuration point, document the required entries instead of changing the policy.

## Existing Personalize tenant configuration

The Web Experience already exists manually in standalone Sitecore Personalize and is in Draft state.

Do not attempt to create it through application code.

Document the current configuration:

- Experience type: Web Experience.
- Status: Draft.
- Point of Sale: `jss-poc-web`.
- Target component root:

  ```css
  [data-personalize-slot="content-block"]
  ```

- Target children:

  ```css
  .contentTitle
  .contentDescription
  ```

- Page-targeting regex:

  ```regex
  ^http://(?:localhost|(?:en|da)\.nextjs105\.local):3000/personalize-demo/?(?:[?#].*)?$
  ```

- Preferred test URLs:

  ```text
  http://en.nextjs105.local:3000/personalize-demo
  http://da.nextjs105.local:3000/personalize-demo
  ```

Document that the existing draft experience must:

- Change only `.contentTitle` and/or `.contentDescription` within the stable root.
- Return safely if the expected component does not exist.
- Update existing elements instead of appending duplicate markup.
- Avoid replacing the React application root.
- Avoid reading authentication or protected application data.
- Remain idempotent when triggered multiple times.

Where useful, include this type of idempotent Web Experience example in the documentation:

```javascript
(function () {
  const root = document.querySelector(
    '[data-personalize-slot="content-block"]'
  );

  if (!root) {
    return;
  }

  const heading = root.querySelector('.contentTitle');
  const content = root.querySelector('.contentDescription');

  if (!heading || !content) {
    return;
  }

  heading.textContent = 'A personalized experience for you';

  const paragraph = document.createElement('p');
  paragraph.textContent =
    'This Content Block was personalized by standalone Sitecore Personalize.';

  content.replaceChildren(paragraph);
  root.setAttribute('data-personalized', 'true');
})();
```

Do not execute this variant code from the Next.js application. It belongs to the manually managed Personalize Web Experience.

## Manual Sitecore setup documentation

Document the manual Sitecore steps without automating them:

1. Create or verify `/personalize-demo`.
2. Add exactly one existing Content Block rendering.
3. Assign a datasource containing useful default `heading` and `content` values.
4. Publish the page and datasource.
5. Revalidate `/personalize-demo` through the existing exact-path revalidation endpoint.
6. Confirm that the public page resolves through the existing catch-all route.
7. Confirm that the default Content Block appears without Personalize.

Do not claim these actions were performed unless they are verified in the running environment.

## Automated tests

Use the repository’s existing test framework and conventions.

Mock the Engage SDK. Automated tests must not depend on a real Personalize tenant.

Add focused tests covering:

1. Engage initialization is disabled when the feature flag is false.
2. Engage initialization is disabled when configuration is incomplete.
3. Engage initialization waits for consent.
4. Engage initializes only once across React rerenders.
5. Initial successful initialization sends one VIEW event.
6. `routeChangeComplete` sends one additional VIEW event.
7. `routeChangeComplete` invokes `triggerExperiences()` once through the supported SDK API.
8. Initial load is not double-counted as a route-change VIEW event.
9. Duplicate route completion does not produce duplicate events where deduplication applies.
10. Excluded routes do not initialize Engage.
11. Excluded routes do not send VIEW events.
12. Excluded routes do not trigger experiences.
13. `/member` and descendants are excluded.
14. Router event handlers are removed when the provider unmounts.
15. Engage initialization failure does not break the application.
16. Engage VIEW-event failure does not create an unhandled rejection.
17. No authentication token, role or session value is included in Personalize event data.
18. The clean browser-visible path is used instead of the internal locale-prefixed route.
19. The active language is derived from the existing locale source of truth.
20. `ContentBlock.tsx` retains its existing rendering behaviour.
21. `ContentBlock.tsx` renders the Sitecore `heading` and `content` fields without Engage.
22. The Content Block root contains:

   ```html
   data-personalize-slot="content-block"
   ```

23. `Text`, `RichText` and the existing CSS classes remain present.
24. `withDatasourceCheck` remains applied.
25. The application renders normally when Personalize is unavailable.

Do not make automated tests call the real Engage endpoint.

## Documentation

Extend the repository documentation and five-minute demo script with:

- Environment configuration.
- The `jss-poc-web` Point of Sale.
- Consent assumptions.
- Feature-flag behaviour.
- Existing catch-all route behaviour.
- Manual `/personalize-demo` Sitecore setup.
- Content Block datasource setup.
- Existing draft Personalize Web Experience setup.
- Page-targeting regex.
- Point of Sale filter.
- Initial load behaviour.
- Client-side navigation behaviour.
- Event Viewer verification.
- Personalize QA/Preview verification.
- CSP requirements.
- Failure and fallback behaviour.
- Relationship with SSG, ISR and on-demand ISR.
- Next.js 16.2 compatibility findings.
- Production recommendation to evaluate server-set cookies separately.
- Limitation of the non-unique Content Block selector.
- `nextjs105.local` cookie-domain limitation.
- Reason the final POC test should use the language subdomains rather than `localhost`.

Do not include real client keys or authentication values in documentation.

## Verification

Run every applicable repository command, including:

- Formatting.
- Linting.
- TypeScript checks.
- Existing tests.
- New Personalize tests.
- Production build.

Confirm from the production build that:

- The existing public catch-all remains static.
- `/personalize-demo` requires no dedicated Next.js route.
- Public pages remain SSG/ISR.
- Member pages remain dynamic SSR pages.
- No member route becomes a static artifact.
- Personalize code does not execute during server rendering or static generation.

Inspect the generated server HTML or direct page response where the running environment permits it.

Confirm that visitor-specific Personalize content is not present in:

- Generated static HTML.
- ISR output.
- Page props.
- Server logs.

The static output must contain only the default Sitecore Content Block content.

## Manual browser verification

After implementation, document the following manual procedure:

1. Add the real Personalize values to the uncommitted local environment configuration.
2. Use:

   ```env
   NEXT_PUBLIC_PERSONALIZE_POINT_OF_SALE=jss-poc-web
   NEXT_PUBLIC_PERSONALIZE_COOKIE_DOMAIN=nextjs105.local
   ```

3. Enable the feature flag.
4. Grant consent using the existing consent manager or documented POC override.
5. Start the Next.js application.
6. Open:

   ```text
   http://en.nextjs105.local:3000/personalize-demo
   ```

7. Confirm the default Sitecore Content Block renders.
8. Use Personalize QA/Preview while the experience remains in Draft.
9. Confirm the variant modifies only the intended Content Block.
10. Confirm the Personalize browser cookie uses the expected local domain.
11. Confirm exactly one initial VIEW event.
12. Navigate to another eligible public route using Next.js client-side navigation.
13. Confirm exactly one additional VIEW event.
14. Navigate back to `/personalize-demo`.
15. Confirm the experience reruns without duplicate markup.
16. Verify the VIEW event in Personalize Event Viewer using the browser ID.
17. Remove any temporary browser-ID logging.
18. Disable or block Personalize and confirm the default Sitecore content remains usable.
19. Do not start the experience live until QA checks pass.

## Externally managed verification boundaries

Do not claim the following checks as completed unless they were manually performed against the running systems:

- Creating or verifying `/personalize-demo` in Sitecore.
- Adding the Content Block rendering and datasource.
- Publishing Sitecore items.
- Invoking revalidation in the running environment.
- Assigning `jss-poc-web` to the Personalize experience filter.
- Personalize QA/Preview verification.
- Personalize Event Viewer verification.
- Browser cookie verification.
- Real consent-platform integration.
- Starting the experience.

The Personalize Web Experience and `jss-poc-web` POS already exist. Report them as preconfigured external dependencies, not as work completed by the coding agent.

## Acceptance criteria

- The public demo route remains SSG/ISR.
- Member routes remain SSR with `Cache-Control: private, no-store`.
- No dedicated Next.js page is created for `/personalize-demo`.
- No new content or promo component is created.
- Generated HTML and ISR output contain only default Sitecore content.
- Personalized content is applied only in the browser after hydration.
- Initial eligible load sends one VIEW event.
- Each eligible completed client-side navigation sends one additional VIEW event.
- Returning to the demo page triggers Web Experience evaluation without duplicate markup.
- Technical routes and `/member` routes produce no Personalize activity.
- Disabling or blocking Personalize leaves the default Content Block usable.
- Personalize errors do not break page rendering or produce unhandled rejections.
- Personalize never calls the revalidation endpoint.
- Personalize never changes cached output per visitor.
- No Auth0 token, session value, Sitecore virtual-user name or security role appears in Personalize event data, browser storage introduced by this milestone, page props, HTML or logs.
- The production build, TypeScript checks, existing tests and new focused tests pass.
- The exact pinned `@sitecore/engage` version is recorded.
- The Next.js 16.2 compatibility result is documented.
- Milestones 0-8 behaviour remains unchanged.

## Completion report

At completion, provide:

1. A concise implementation summary.
2. Files added and changed.
3. The exact pinned `@sitecore/engage` version.
4. Formatting, lint, type-check, test and production-build results.
5. Next.js 16.2 compatibility findings.
6. The actual SDK initialization API used.
7. How `triggerExperiences()` is invoked.
8. Whether a window global was required.
9. Manual Sitecore steps still required.
10. Manual Personalize steps still required.
11. CSP changes or documented requirements.
12. Consent implementation and local override instructions.
13. Local cookie-domain assumptions.
14. Production limitations and recommendations.
15. Explicit confirmation that no dedicated Next.js page was created.
16. Explicit confirmation that no new content component was created.
17. Explicit confirmation that `/member` remains excluded from Personalize.
18. Explicit confirmation that Milestones 0-8 behaviour and security boundaries were preserved.