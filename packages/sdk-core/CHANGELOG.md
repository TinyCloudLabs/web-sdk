# @tinycloudlabs/sdk-core

## 2.0.0

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

- b863afb: Fix sharing link delegation bugs

  - Fix 401 Unauthorized error: Clamp sharing link expiry to session expiry to ensure child delegation expiry never exceeds parent
  - Fix "Invalid symbol 32" base64 decode error: Remove incorrect "Bearer " prefix from authHeader in sharing link data

- Updated dependencies [866981c]
  - @tinycloudlabs/web-core@2.0.0
  - @tinycloudlabs/sdk-services@2.0.0

## 0.2.0

### Minor Changes

- a2b4b66: Create sdk-core package with shared interfaces and TinyCloud class

  - ISigner: Platform-agnostic signer interface
  - ISessionStorage: Session persistence abstraction
  - IUserAuthorization: Main authorization interface
  - ITinyCloudStorage: Storage operations interface
  - TinyCloud: Unified SDK class that accepts IUserAuthorization

  This package enables code sharing between web-sdk and node-sdk while
  allowing platform-specific implementations for signing and session storage.

### Patch Changes

- @tinycloudlabs/web-core@0.3.1
