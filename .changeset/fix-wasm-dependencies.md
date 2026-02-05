---
"@tinycloud/web-sdk-wasm": patch
"@tinycloud/node-sdk-wasm": patch
---

Fix broken npm packages by removing invalid @tinycloud/sdk-rs dependency

- web-sdk-wasm: Removed runtime dependency on sdk-rs (WASM is bundled by rollup)
- node-sdk-wasm: Removed runtime dependency on sdk-rs, now properly bundles WASM files into dist/wasm/ during build
