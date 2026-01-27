# @tinycloudlabs/node-sdk-wasm

## 0.1.1

### Patch Changes

- a2b4b66: Fix build order to ensure WASM artifacts are built before TypeScript packages

  Added `@tinycloudlabs/sdk-rs` as a dependency so turbo builds WASM first.

- a2b4b66: Rename web-sdk-rs to sdk-rs for clearer naming

  - Renamed `packages/web-sdk-rs` to `packages/sdk-rs`
  - Renamed WASM output directories:
    - `pkg` -> `web-sdk-wasm`
    - `pkg-nodejs` -> `node-sdk-wasm`
  - Updated all build scripts, documentation, and CI workflows

- Updated dependencies [69fc83e]
  - @tinycloudlabs/sdk-rs@0.3.1
