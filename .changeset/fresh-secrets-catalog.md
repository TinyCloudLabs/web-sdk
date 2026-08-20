---
"@tinycloud/sdk-services": patch
"@tinycloud/sdk-core": patch
"@tinycloud/node-sdk": patch
"@tinycloud/web-sdk": patch
---

Add `secrets.listAll()` to discover global and scoped secret names across the
canonical vault keyset without decrypting secret values.
