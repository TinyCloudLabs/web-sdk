---
"@tinycloudlabs/node-sdk": patch
---

Create node-sdk package with Node.js-specific TinyCloud SDK implementations.

This package provides:
- `PrivateKeySigner`: ISigner implementation using private keys via WASM
- `NodeUserAuthorization`: IUserAuthorization with configurable sign strategies
  - auto-sign: Automatically approve all sign requests
  - auto-reject: Reject all sign requests
  - callback: Delegate to custom callback function
  - event-emitter: Emit sign requests as events
- `MemorySessionStorage`: In-memory ISessionStorage
- `FileSessionStorage`: File-based ISessionStorage for session persistence

Part of TC-401: IUserAuthorization shared interface implementation.
