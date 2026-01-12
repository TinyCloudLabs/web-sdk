---
"@tinycloudlabs/web-sdk": patch
---

Fix space creation flow and host configuration consistency

- Fixed sign-in flow to setup space session before calling extension hooks
- Added `getTinycloudHosts()` method to `IUserAuthorization` interface
- Updated `TinyCloudStorage` to use hosts from `UserAuthorization` for consistency
- Fixed `tryResumeSession` to also setup space before extension hooks
- Updated demo app to pass `tinycloudHosts` at top level config

This ensures the space exists before `TinyCloudStorage.afterSignIn()` runs,
preventing "Space not found" errors during session activation.
