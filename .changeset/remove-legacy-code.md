---
"@tinycloud/web-sdk": minor
"@tinycloud/sdk-core": minor
"@tinycloud/web-core": minor
---

Remove legacy code for v1 cleanup

- Remove deprecated `onSessionExtensionNeeded` callback from SharingService (use `onRootDelegationNeeded` instead)
- Remove deprecated `extendSessionForSharing()` method from TinyCloudWeb
- Remove legacy `delegationCid` share link format support (only `cid` is supported)
- Remove legacy fallback in `getSessionExpiry()`
- Remove unused `express` and `express-session` dependencies from web-core
