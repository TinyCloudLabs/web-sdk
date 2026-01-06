---
"@tinycloudlabs/web-sdk-wasm": patch
"@tinycloudlabs/node-sdk-wasm": patch
---

Rename web-sdk-rs to sdk-rs for clearer naming

- Renamed `packages/web-sdk-rs` to `packages/sdk-rs`
- Renamed WASM output directories:
  - `pkg` -> `web-sdk-wasm`
  - `pkg-nodejs` -> `node-sdk-wasm`
- Updated all build scripts, documentation, and CI workflows
