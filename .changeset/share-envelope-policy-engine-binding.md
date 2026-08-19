---
"@tinycloud/share-envelope": minor
---

Add an optional, signature-covered `policyEngine` block to `ShareEnvelopeV3`:
the standalone Policy Engine endpoint, pinned audience and grant-issuer DID, the
content-addressed `policyId` the owner registered, and the evidence
`requirementId` the recipient satisfies.

The recipient decides which engine to talk to and which policy to name from
these bytes, so both are authority decisions and have to be inside the envelope
the owner signed — a value supplied by whatever host served the page could point
the recipient at a different engine or a different policy. The field is optional
so a deployment with no engine enrolled, and bearer/link-only sharing, are
unchanged.

Accountless envelopes pair that block with a signed `localContent` binding: a
content key sealed under the link's envelope key plus the exact ciphertext
digest. In this mode the legacy Node policy roots and enforcer attestation are
absent, so parsing and verification do not create a dependency on Node
`/share/*` routes. Legacy v3 envelopes continue to require and verify those
fields exactly as before.
