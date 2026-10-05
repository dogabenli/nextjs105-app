# Test plan

## Test identities

| Persona        | Auth0 role       | Expected Sitecore role                                                            |
| -------------- | ---------------- | --------------------------------------------------------------------------------- |
| Anonymous      | none             | `extranet\\anonymous`                                                             |
| Basic member   | `member-basic`   | `extranet\\Extranet 1`, via base `extranet\\Extranet`                             |
| Premium member | `member-premium` | `extranet\\Extranet 2`, via base `extranet\\Extranet` plus explicit premium grant |
| No-role user   | none             | Rejected before Layout Service                                                    |

## Functional matrix

| Scenario                              | Expected result                                              |
| ------------------------------------- | ------------------------------------------------------------ |
| Anonymous opens public home           | `200`, static response                                       |
| Basic user opens public home          | Same shared static content; header identity loads separately |
| Anonymous opens `/member`             | Redirect to Auth0                                            |
| Login returns to original member path | Member page SSR renders                                      |
| Basic opens page 1                    | `200`                                                        |
| Basic opens premium page 3            | `403`                                                        |
| Premium opens page 3                  | `200`                                                        |
| No-role user opens member page        | `403`                                                        |
| Logout then refresh member page       | Redirect to Auth0                                            |
| Missing member item                   | `404`                                                        |

## Token-negative matrix

| Token condition              | Expected Sitecore response |
| ---------------------------- | -------------------------- |
| Missing                      | `401`                      |
| Expired                      | `401`                      |
| Wrong issuer                 | `401`                      |
| Wrong audience               | `401`                      |
| Modified payload/signature   | `401`                      |
| Valid, unknown external role | `403`                      |
| Valid, empty mapped roles    | `403`                      |

## Cache tests

| Test                                   | Evidence                                               |
| -------------------------------------- | ------------------------------------------------------ |
| Public route is SSG                    | Build output and cache/debug log classify it as static |
| Public route stays stale after publish | HTML/content remains unchanged before revalidation     |
| Exact path revalidation works          | Content changes after successful POST                  |
| Member route is SSR                    | Server timestamp/correlation changes per request       |
| Member response is private             | `Cache-Control: private, no-store`                     |
| Member path cannot be revalidated      | Endpoint returns `400` or `403`                        |

## Leakage tests

- Search rendered HTML and `__NEXT_DATA__` for access-token fragments.
- Inspect browser local and session storage.
- Inspect browser network calls. No bearer token should be sent from browser JavaScript to Sitecore.
- Inspect Next.js and Sitecore logs for Authorization headers, cookies, tokens, email, and raw claims.
- Log in as premium, log out, then log in as basic in the same browser. Premium content must not remain available through cache or back navigation after a hard refresh.

## Route-hardening tests

Test the protected-route matcher and revalidation rejection with:

```text
/member
/member/
/member/page-1
/membership
//member/page-1
/%6dember/page-1
/member/../about
https://attacker.example/member
```

Expected results must be defined after one canonical normalization step. Prefix-confusion and encoded forms must never bypass the protected boundary.

## Regression checks

- Experience Editor still loads the intended routes under its existing mode.
- Public language routing still works.
- Existing public 404 behavior remains intact.
- Public Layout Service calls still use the Sitecore API key as before.
- A failed ISR regeneration retains the last good static page.

## Five-minute demonstration

1. Show the static public page classification and default `/personalize-demo` Content Block.
2. With Personalize enabled and consent granted, open the demo page on `en.nextjs105.local`; show the draft experience in QA/Preview and its change to only the selected Content Block.
3. Navigate to another public page and back; verify one VIEW per completed navigation and that the hosted Web Personalization script reruns without duplicate markup.
4. Show the default content remains usable when Personalize is disabled or blocked. The full setup and verification sequence is in [11-personalize.md](11-personalize.md).
5. Change/publish public content, refresh, and show it is still cached; call the exact-path revalidation endpoint and show the new default content.
6. Open a member page anonymously and log in as basic; show basic page success and premium page denial.
7. Log in as premium and show premium page success, then show Sitecore Access Viewer roles and a sanitized server log proving virtual-user mapping.
