---
"@tinycloudlabs/sdk-core": patch
"@tinycloudlabs/web-sdk": patch
"@tinycloudlabs/node-sdk": patch
---

Fix sharing link delegation bugs

- Fix 401 Unauthorized error: Clamp sharing link expiry to session expiry to ensure child delegation expiry never exceeds parent
- Fix "Invalid symbol 32" base64 decode error: Remove incorrect "Bearer " prefix from authHeader in sharing link data
