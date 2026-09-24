# VS Code Copilot runbook

Use one prompt per milestone. Attach or reference the relevant documentation and current files. Review every diff before accepting it.

## Prompt 0. Inventory

```text
Read README.md, docs/01-architecture.md, docs/02-milestones.md, and .github/copilot-instructions.md. Perform Milestone 0 only. Inspect the repository and report exact versions, current JSS routing/data-fetching files, the Sitecore .NET solution structure, and the files you propose to change. Do not edit yet. Highlight any mismatch with the documented assumptions.
```

After reviewing the report:

```text
Implement only the approved Milestone 0 documentation or diagnostic changes. Run the existing builds and tests. Do not add authentication yet.
```

## Prompt 1. Sitecore roles

```text
Read docs/04-sitecore-security.md and Milestone 1. Produce an exact Sitecore role, inheritance, and item-rights checklist for our actual member item path. If serialization is already used, propose the minimal serialization items. Do not broaden any Sitecore Client permissions.
```

## Prompt 2. Auth0

```text
Read docs/03-auth0-setup.md and Milestone 2. Generate an environment-variable template and a manual Auth0 Dashboard checklist for a Pages Router JSS 23 app. Do not create or store passwords. Use the documented audience and namespaced roles claim.
```

## Prompt 3. Next.js login

```text
Read docs/03-auth0-setup.md, docs/05-nextjs-hybrid-rendering.md, and Milestone 3. Inspect our exact Next.js version first and select a compatible pinned @auth0/nextjs-auth0 major for Pages Router. Show the proposed files before editing. Then implement login, callback, logout, session access, and a safe returnTo flow. Tokens must remain server-only. Run type-check, lint, and tests.
```

## Prompt 4. Hybrid routes

```text
Read docs/05-nextjs-hybrid-rendering.md, docs/language-subdomain-poc/domain-based-i18n-ssg-isr.md, and Milestone 4. Preserve the existing public SSG catch-all under src/pages/[locale]/[[...path]].tsx. Add the explicit member optional catch-all at src/pages/[locale]/member/[[...path]].tsx using getServerSideProps, reading locale from context.params.locale like normal-mode.ts does, and reuse our current SitecorePagePropsFactory and page component. First show how the member params become the Sitecore path and how returnTo strips the locale prefix. Do not add the bearer Layout Service call yet. Add route and redirect tests, then build.
```

## Prompt 5. Sitecore .NET adapter

```text
Read docs/04-sitecore-security.md, docs/06-sitecore-dotnet-authentication.md, and Milestone 5. Inspect the Sitecore 10.5 assemblies and the existing OWIN initialization conventions in this solution. Propose the exact NuGet/assembly references and patch location before editing. Implement only the Auth0 token validator, protected request matcher, closed role mapper, request-scoped virtual user, configuration patch, and focused tests. Do not create persisted Sitecore users. Do not log claims or tokens.
```

## Prompt 6. Member Layout Service client

```text
Read docs/05-nextjs-hybrid-rendering.md, docs/06-sitecore-dotnet-authentication.md, and Milestone 6. Inspect the existing RestLayoutService configuration and SitecorePagePropsFactory. Implement a server-only member layout fetch that adds the bearer token per request without mutating a global client. Map 401, 403, and 404 distinctly. Never return the access token in props. Run build and tests.
```

## Prompt 7. ISR

```text
Read docs/07-on-demand-isr.md and Milestone 7. Implement the POST-only on-demand revalidation endpoint and independent path-validation helpers/tests. It must reject /member after decoding and normalization and must use an Authorization header secret. Preserve public getStaticProps and do not add a timed revalidate interval. Verify with next build and next start.
```

## Prompt 8. Final verification

```text
Read docs/08-test-plan.md and Milestone 8. Execute every automated test available. Produce a manual test checklist for anything requiring Auth0 or Sitecore UI. Search the repository and generated browser props for accidental token or secret exposure. Summarize evidence for each root README success criterion. Do not add new architecture.
```

## Diff-review questions

Ask these after every Copilot edit:

1. Which lines can expose a token or secret?
2. Which route can accidentally become static or publicly cached?
3. Can an unknown external role become a Sitecore role?
4. Can direct Layout Service access bypass Next.js?
5. Does any global mutable object contain a per-request token or user?
6. What happens on token expiry, Auth0 outage, Sitecore outage, and failed ISR?

