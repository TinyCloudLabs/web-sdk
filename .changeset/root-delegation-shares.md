---
"@tinycloud/sdk-core": minor
"@tinycloud/web-sdk": minor
---

feat: Add root delegation support for long-lived share links

When creating share links with expiry longer than the current session, the SDK now creates a direct delegation from the wallet (PKH) to the share key, bypassing the session delegation chain. This allows share links to have any expiry duration regardless of session length.

**New callback**: `onRootDelegationNeeded` in SharingServiceConfig
- Called when share expiry exceeds session expiry
- Receives the share key DID to delegate to
- Returns a direct wallet-to-share-key delegation

**Deprecated**: `onSessionExtensionNeeded` - does not solve the expiry problem as sub-delegations are still constrained by parent expiry.

**Breaking change**: None - new callback is optional, falls back to existing behavior.
