---
"@tinycloud/node-sdk-wasm": patch
---

Fix CJS/ESM module resolution for wasm-pack output on Bun Linux

Rename wasm-pack CJS output from `.js` to `.cjs` extension so Bun correctly
treats it as CommonJS in a `"type": "module"` package. Fixes `Export named
'vault_x25519_from_seed' not found` error on Linux Bun.
