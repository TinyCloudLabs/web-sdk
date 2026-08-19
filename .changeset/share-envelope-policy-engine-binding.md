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
