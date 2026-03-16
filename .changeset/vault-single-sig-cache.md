---
"@tinycloud/sdk-services": patch
---

Consolidate vault unlock to a single wallet signature. Both master key and encryption identity are now derived from one signature via `deriveKey()` with different salt/info parameters. Add browser-side signature caching via IndexedDB with a non-extractable AES-GCM CryptoKey, making subsequent unlocks instant without requiring the signer. Gracefully no-ops in Node.js.
