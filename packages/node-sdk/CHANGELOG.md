# @tinycloudlabs/node-sdk

## 0.2.0

### Minor Changes

- a2b4b66: Breaking API changes for node-sdk delegation system

  ### node-sdk

  **BREAKING: `allowSubDelegation` → `disableSubDelegation`**

  - Sub-delegation is now allowed by default (aligns with ocap/UCAN expectations)
  - Use `disableSubDelegation: true` to prevent recipients from creating sub-delegations
  - Before: `createDelegation({ allowSubDelegation: true })` to enable
  - After: `createDelegation({})` enables by default, use `disableSubDelegation: true` to disable

  **BREAKING: `autoCreateNamespace` default changed to `false`**

  - Namespaces are no longer auto-created during sign-in
  - Use `autoCreateNamespace: true` explicitly for namespace owners
  - Delegates using shared namespaces should not set this flag

  ### web-sdk

  - Fixed `KVServiceAdapter` to include `jwk` property required by `ServiceSession`

### Patch Changes

- a2b4b66: Create node-sdk package with Node.js-specific TinyCloud SDK implementations.

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

- a2b4b66: Fix delegation chain support for user-to-user delegations

  - Added `pkhDid` getter for PKH DID format (`did:pkh:eip155:{chainId}:{address}`)
  - Fixed `createDelegation` to use `delegateUri` for targeting recipient's PKH DID
  - Fixed `createSubDelegation` to use `delegateUri` instead of generating random JWK
  - Fixed sub-delegation expiry to cap at parent's expiry instead of throwing error
  - Updated demo to use `pkhDid` for all delegations

  Full delegation chain now works: Alice → Bob → Charlie

- Updated dependencies [a2b4b66]
- Updated dependencies [a2b4b66]
- Updated dependencies [a2b4b66]
  - @tinycloudlabs/sdk-core@0.2.0
  - @tinycloudlabs/node-sdk-wasm@0.1.1
  - @tinycloudlabs/web-core@0.3.1
