---
"@tinycloud/sdk-core": minor
---

Add `@tinycloud/sdk-core/policy-access`: reusable, application-facing APIs for
an accountless policy-gated read — ephemeral holder key, OpenCredentials
delivered-email/OTP acquisition, direct Policy Engine presentation
(`/policy/v0/challenge` + `/policy/v0/resolve`), delegation import and read
through the generic TinyCloud Node `/delegate` and `/invoke` routes, and local
decryption. The built-in transport pins allowed origins and refuses `/share/*`
paths, so no application-specific node route can appear in the flow.

Also teaches the node-native delegation parser to recognise `kv` and `vfs`
resource segments alongside `sql`.
