---
"@tinycloud/sdk-services": patch
---

Cache vault signatures in IndexedDB (encrypted with non-extractable AES-GCM CryptoKey) to eliminate repeated wallet popups on unlock. Skip identity signing entirely when public key already exists in public space. Add version-keyed signing constants (VaultVersionConfig) for forward-compatible key derivation. Gracefully no-ops in Node.js.
