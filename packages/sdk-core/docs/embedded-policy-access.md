# Embedded policy access

`admitPolicyCredentialV4` is an application-facing browser primitive for a
credential-gated TinyCloud read. The caller creates or restores a tab-scoped
`did:key` holder, obtains and verifies an OpenCredentials credential for that
same holder, then calls the primitive with the signed policy and the exact
requested capability.

The primitive sends the credential presentation only to the policy runtime at
the supplied TinyCloud Node origin (`/policy/v3` by default). It verifies the
returned short-lived, holder-bound ordinary delegation and activates it through
the Node's generic `POST /delegate`. Applications then create their normal
holder-signed invocation and use generic `POST /invoke` to obtain ciphertext.
They must verify and decrypt that ciphertext locally; this API never accepts a
plaintext response or a decryption key.

```ts
const admitted = await admitPolicyCredentialV4({
  nodeOrigin: "https://node.example",
  policy, policyCid, policyRootCid, enforcementRootCid,
  expectedNodeAudience, expectedEnforcerDid,
  credential, requirement,
  requestedCapabilities: [exactReadCapability],
  sign: holder.signDigest,
});

// `admitted.session.authorization` is activated already. Use it as the
// parent of a fresh holder-signed generic /invoke UCAN, then decrypt locally.
```

There is no Policy Engine origin, health probe, admission service, or
Share-specific data-plane endpoint in this flow. A custom policy-control path
may be supplied only as a `/policy/...` path on the same Node origin.
