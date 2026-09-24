# Sitecore security configuration

## Content boundary

Treat this item as the security root:

```text
/sitecore/content/<tenant>/<site>/Home/member
```

The route boundary and the Sitecore security boundary must represent the same logical subtree. A differently named or aliased protected item must be added to both configurations.

## Roles

Already created in Sitecore:

```text
extranet\Extranet 1
extranet\Extranet 2
```

Add a shared base role that both are members of:

```text
extranet\Base Extranet
```

Make both `extranet\\Extranet 1` and `extranet\\Extranet 2` members of `extranet\\Extranet`. There is no direct inheritance between `Extranet 1` and `Extranet 2` - the base role is what grants their common member-root access. Grant read on the member root and descendants to `extranet\\Extranet` only; grant the premium-only item to `extranet\\Extranet 2` explicitly.

## Suggested ACL for the demo

| Item | Anonymous | Extranet (base) | Extranet 1 | Extranet 2 |
| --- | --- | --- | --- | --- |
| `member` | Deny Read | Allow Read | Inherited Allow (via base) | Inherited Allow (via base) |
| `member/page-1` | Inherited Deny | Inherited Allow | Inherited Allow | Inherited Allow |
| `member/page-2` | Inherited Deny | Inherited Allow | Inherited Allow | Inherited Allow |
| `member/page-3` | Inherited Deny | No grant | No grant | Allow Read (explicit) |

Use the Access Viewer to confirm effective rights. Avoid broad write, language-write, workflow, or Sitecore Client permissions. These are website visitor roles only.

## Publishing

Publish the protected items and security changes to the web database used by Layout Service. Verify against the CD endpoint, not only CM Preview.

## Virtual-user naming

Build the username from the immutable Auth0 `sub`, not email. A safe example is:

```text
extranet\auth0_<base64url_sha256(sub)>
```

Hashing avoids illegal Sitecore username characters and avoids exposing the provider identifier in logs. The virtual user is transient and must not be created in the Sitecore security database.

## Role mapping

Use a closed mapping such as:

```text
member-basic   -> extranet\Extranet 1
member-premium -> extranet\Extranet 2
```

Ignore unknown external roles. Never concatenate an Auth0 role into `extranet\\<role>`, because a manipulated or newly created upstream role could gain unintended Sitecore access.

## Authorization order

1. Validate the bearer token.
2. Require `sub`.
3. Read the configured namespaced roles claim.
4. Translate through the allowlist.
5. Reject a user with zero mapped member roles.
6. Build an authenticated virtual user.
7. Assign mapped Sitecore roles.
8. Run Layout Service under a scoped user switcher.
9. Dispose the switcher even when rendering fails.

## Direct endpoint verification

Test the CD Layout Service endpoint outside Next.js:

1. No bearer token and public route. Expect `200`.
2. No bearer token and member route. Expect no protected route data.
3. Basic token and basic page. Expect `200`.
4. Basic token and premium page. Expect `403` or no accessible route, according to the adapter contract.
5. Premium token and premium page. Expect `200`.
6. Wrong-audience token. Expect `401`.

Do not rely only on hiding navigation or redirecting in Next.js. A caller can address Layout Service directly.

