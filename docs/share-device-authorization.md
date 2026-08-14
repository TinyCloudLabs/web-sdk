# Share-first device authorization

`tc share publish` can bootstrap a new remote or headless user without requiring
`tc init` or a pre-existing TinyCloud profile. The CLI creates an Ed25519
session key locally, sends only its public JWK and DID to OpenKey, prints a
verification URL and short user code, and polls until the user approves.

The same behavior is available explicitly:

```bash
tc auth login --device
tc enable share
```

Interactive `tc auth login` continues to use the loopback browser callback.
Non-interactive login prefers device authorization. `--paste` remains an
explicit manual fallback and is never selected implicitly.

The device request is limited to `tinycloud.capabilities/read` for the
`applications` space. That capability can request the existing body-bound,
one-shot Node Share upload attestation; it does not confer general KV/SQL
authority and does not create a Share space. OpenKey binds the result to the
CLI session DID/public key, Node and Share origins, requested permissions, and
the approved expiry. The default delegation lifetime is 30 days. Share object
retention remains seven days.

The CLI holds a 256-bit device secret and independent PKCE verifier. OpenKey
stores only their hashes, rate-limits creation and polling, encrypts approved
delegations at rest, and releases each result once. No private CLI key is sent
to OpenKey or the Share registry.

## Hermetic public smoke

Build the CLI, then run the cross-repository smoke from the OpenKey checkout:

```bash
bun run --cwd packages/cli build
bun ../openkey/scripts/share-device-auth-smoke.ts --cli "$PWD/packages/cli/dist/index.js"
```

The harness invokes the public `tc share publish report.md` entry point against
real local HTTP protocol services and a cryptographically valid delegation. It
asserts the device prompt, persisted session, two attested uploads, seven-day
retention, and complete Share URL.
