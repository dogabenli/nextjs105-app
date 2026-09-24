# Sitecore .NET authentication adapter

## Purpose

Add one small .NET Framework 4.8 module to Sitecore CD. It acts as an Auth0 bearer-token adapter for protected Layout Service requests. It does not host login pages, store passwords, call the Auth0 Management API, or create persistent Sitecore users.

## Suggested project structure

```text
src/
  Feature.MemberAuthentication/
    Configuration/
      MemberAuthenticationOptions.cs
    Authentication/
      Auth0TokenValidator.cs
      Auth0Claims.cs
    Authorization/
      SitecoreRoleMapper.cs
    Owin/
      MemberAuthenticationMiddleware.cs
      UseMemberAuthentication.cs
    App_Config/Include/Feature/
      Feature.MemberAuthentication.config
tests/
  Feature.MemberAuthentication.Tests/
    SitecoreRoleMapperTests.cs
    ProtectedRequestMatcherTests.cs
```

Match the solution's established Foundation/Feature naming if it already uses Helix.

## Middleware boundary

Register middleware in the Sitecore OWIN initialization pipeline. The middleware must wrap the downstream Layout Service execution so the virtual user remains active while Sitecore resolves the route and fields.

Apply authentication only when both are true:

1. the request targets the configured JSS Layout Service endpoint;
2. the requested Sitecore item path is `/member` or begins with `/member/` after normalization.

Do not use a loose `Contains("member")` test. Put matching logic in a small independently tested class.

## Token validation

Use the Auth0 OpenID Connect discovery document and JWKS through Microsoft IdentityModel libraries compatible with the Sitecore solution. Cache signing configuration with the library's configuration manager and support signing-key rollover.

Validation parameters must include:

- exact issuer;
- expected API audience;
- signature validation;
- lifetime validation;
- small intentional clock skew;
- allowed signing algorithm if supported by the chosen compatible library.

Return `401` with a generic message when validation fails. Do not include token contents or low-level cryptographic details in the client response.

## Virtual-user scope

After validation:

1. Derive a safe username from a hash of `sub`.
2. Build an authenticated virtual user in `extranet` using the Sitecore 10.5 Security API available in the referenced assemblies.
3. Resolve only the allowlisted Sitecore roles.
4. Add those roles to the virtual user.
5. Reject with `403` if none maps.
6. Wrap `await next()` in a Sitecore user-switching scope.
7. Dispose the scope in all cases.

Conceptual shape:

```csharp
public async Task Invoke(IOwinContext context)
{
    if (!_matcher.IsProtectedLayoutRequest(context.Request))
    {
        await Next.Invoke(context);
        return;
    }

    var principal = await _tokenValidator.ValidateAsync(ReadBearer(context.Request));
    var roles = _roleMapper.Map(principal);
    if (roles.Count == 0)
    {
        context.Response.StatusCode = 403;
        return;
    }

    var user = _virtualUserFactory.Create(principal, roles);
    using (new Sitecore.Security.Accounts.UserSwitcher(user))
    {
        await Next.Invoke(context);
    }
}
```

The exact Sitecore virtual-user factory API must be selected from the Sitecore 10.5 assemblies already used by the solution. Common Sitecore APIs differ across solution generations. Do not introduce a persistent Membership-provider user as a shortcut.

## Configuration example

Create a role-specific include patch with settings equivalent to:

```xml
<settings>
  <setting name="MemberAuth.Enabled" value="true" />
  <setting name="MemberAuth.Authority" value="https://tenant.auth0.com/" />
  <setting name="MemberAuth.Audience" value="https://sitecore-member-poc-api" />
  <setting name="MemberAuth.RolesClaim" value="https://sitecore-poc.example/roles" />
  <setting name="MemberAuth.ProtectedRoot" value="/member" />
</settings>
```

Patch the OWIN initializer according to the existing Sitecore solution conventions. Use environment transforms for real tenant values.

## Status contract

| Situation | Status |
| --- | --- |
| Missing bearer token on protected layout request | `401` |
| Invalid signature, issuer, audience, or expiry | `401` |
| Valid identity but no mapped role | `403` |
| Valid identity and mapped role | Continue to Layout Service |
| Item denied by Sitecore ACL | `403` or inaccessible route response, normalized by the client |

## Logging

Log:

- a correlation ID;
- success/failure category;
- protected route classification;
- mapped role count;
- elapsed validation time.

Do not log bearer tokens, cookies, raw claims, email, name, Auth0 subject, or the derived username.

## Unit tests

At minimum cover:

- exact root and descendant path matching;
- prefix-confusion routes such as `/membership`;
- encoded or double-slash path normalization;
- known and unknown role mapping;
- duplicate roles;
- zero mapped roles;
- restoration of the prior Sitecore context in an integration test if practical.

