---
"@tinycloudlabs/sdk-core": major
"@tinycloudlabs/web-sdk": major
"@tinycloudlabs/node-sdk": major
"@tinycloudlabs/web-core": major
"@tinycloudlabs/sdk-services": major
"@tinycloudlabs/web-sdk-wasm": major
"@tinycloudlabs/node-sdk-wasm": major
---

# v1.0.0 Release

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
