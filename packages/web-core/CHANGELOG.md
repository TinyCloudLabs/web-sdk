# @tinycloudlabs/web-core

## 1.0.0

### Major Changes

- 866981c: # v1.0.0 Release

  ## Protocol Version System

  - Added `checkNodeVersion()` to all sign-in flows for SDK-node compatibility verification
  - Added `ProtocolMismatchError` and `VersionCheckError` error types
  - SDK now requires TinyCloud Node v1.0.0+ with `/version` endpoint

  ## API Surface Cleanup

  - Replaced blanket `export *` with explicit curated exports
  - Renamed 40+ `TCW`-prefixed types (e.g. `TCWClientSession` -> `ClientSession`, `TCWExtension` -> `Extension`)
  - Trimmed internal utilities from public API surface

  ## Breaking Changes

  - All `TCW`-prefixed types have been renamed (drop the `TCW` prefix)
  - Blanket re-exports from `@tinycloudlabs/web-core` removed; use explicit named imports
  - Some internal sdk-core utilities removed from public API
  - `SharingServiceV2` alias removed; use `SharingService` directly

### Patch Changes

- Updated dependencies [866981c]
  - @tinycloudlabs/web-sdk-wasm@1.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [8c448f1]
- Updated dependencies [a2b4b66]
- Updated dependencies [a2b4b66]
  - @tinycloudlabs/web-sdk-wasm@0.4.0

## 0.3.0

### Minor Changes

- 91c8c4d: Update capability formation and usage to match TinyCloud node changes

### Patch Changes

- Updated dependencies [91c8c4d]
  - @tinycloudlabs/web-sdk-wasm@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [5a37904]
  - @tinycloudlabs/web-sdk-wasm@0.2.1

## 0.2.0

### Minor Changes

- 64affb0: Bring up to date with EIP-5573

### Patch Changes

- Updated dependencies [64affb0]
- Updated dependencies [491f83c]
  - @tinycloudlabs/web-sdk-wasm@0.2.0

## 0.1.2

### Patch Changes

- 23dcfb2: Updated release
- Updated dependencies [23dcfb2]
  - @tinycloudlabs/web-sdk-wasm@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [45bae72]
  - @tinycloudlabs/web-sdk-wasm@0.1.1

## 0.1.0

### Minor Changes

- 5777341: Initial Web SDK Release

### Patch Changes

- Updated dependencies [5777341]
  - @tinycloudlabs/web-sdk-wasm@0.1.0
