# Decisions, non-goals, and production follow-ups

## Architecture decisions

| Decision | Reason |
| --- | --- |
| Separate physical Next.js routes | Next.js rendering mode is selected per page module; the route boundary is easy to verify |
| Public SSG plus on-demand ISR | Demonstrates content freshness without rebuilding or per-request rendering |
| Member SSR only | Prevents shared caching of user-specific or protected output |
| Auth0 Regular Web Application | Fits server-managed sessions and Universal Login |
| Access token forwarded server-to-server | Sitecore must independently validate the caller; token stays out of browser code |
| Sitecore CD extension as .NET backend | It can create virtual users and exercise native Sitecore ACLs with minimal moving parts |
| Closed role mapping | Prevents arbitrary external role names from becoming Sitecore permissions |
| Transient virtual users | Avoids synchronizing demo users into the Sitecore security database |

## POC non-goals

- Self-registration, password reset customization, MFA policy design, or social identity providers.
- A custom user database.
- Auth0 Management API automation.
- Refresh-token persistence or offline access.
- Fine-grained entitlements beyond two demo roles.
- Multi-tenant organizations.
- Shared ISR cache across a scaled Next.js cluster.
- Full observability, SIEM integration, or production audit retention.
- Automated dependency analysis for publishing and revalidating every related page.
- Production-grade high availability or disaster recovery.
- Replacing Sitecore Identity for CM users.

## Known POC caveats

- The Auth0 SDK version must match the JSS 23 starter's actual Next.js version. Current Auth0 quickstarts may target App Router and newer Next.js releases.
- Sitecore virtual-user APIs and OWIN registration should be verified against the solution's exact 10.5 assemblies.
- Item-security failures may surface from Layout Service as an inaccessible route rather than a literal `403`. Normalize this contract in the adapter/client and document the observed behavior.
- Experience Editor requests need explicit regression testing. The protected middleware must not interfere with editor or CM flows.
- Auth0 free-tier limits and features can change. The POC only needs a few manually managed database users and roles.

## Production follow-up decisions

Before production, decide:

1. Whether Sitecore CD or a dedicated ASP.NET Core BFF/gateway owns token validation.
2. Whether member HTML may be privately cached at an authenticated edge.
3. How refresh tokens, session revocation, logout propagation, and role-change latency are handled.
4. How multiple Next.js instances share ISR state.
5. How publish events resolve all affected routes and languages.
6. How keys, secrets, configuration, and certificates are rotated.
7. What identity and authorization events must be audited.
8. Whether xConnect identification and analytics are required for authenticated users.
9. How penetration, dependency, and threat-model reviews are performed.

## Go or no-go criteria after the POC

Proceed only if:

- direct Layout Service bypass tests fail safely;
- role mapping is deterministic and auditable;
- protected HTML and JSON never enter a shared cache;
- content authors can still publish and use the intended editing experience;
- operational owners accept the session, token-expiry, and revalidation behavior.

