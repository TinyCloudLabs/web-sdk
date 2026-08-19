# `policy-access-reader` — a non-Share consumer

A minimal, self-contained example of an application that is **not** TinyCloud
Share reading a policy-gated encrypted resource through
`@tinycloud/sdk-core/policy-access`.

The scenario: a clinic publishes an encrypted lab report into its own TinyCloud
space and a policy that admits exactly one patient's email address. The patient
opens a link in a fresh browser, proves the mailbox with a one-time code, and
reads the report. The patient has no TinyCloud account and never sees an
identity provider.

Nothing in `reader.ts` imports Share. The only TinyCloud dependency is the
public `@tinycloud/sdk-core/policy-access` entry point, which is the point:
if this example compiles and runs, the API is genuinely app-agnostic.

Run the accompanying test from the package root:

```bash
bun test src/policy-access/example.test.ts
```
