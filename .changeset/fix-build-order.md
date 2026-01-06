---
"@tinycloudlabs/node-sdk-wasm": patch
"@tinycloudlabs/web-sdk-wasm": patch
---

Fix build order to ensure WASM artifacts are built before TypeScript packages

Added `@tinycloudlabs/sdk-rs` as a dependency so turbo builds WASM first.
