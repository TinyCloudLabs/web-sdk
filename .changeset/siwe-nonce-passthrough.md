---
"@tinycloud/web-sdk": patch
---

Pass siweConfig.nonce through to the SIWE message via prepareSession, enabling server-provided nonce injection for single-signature auth flows
