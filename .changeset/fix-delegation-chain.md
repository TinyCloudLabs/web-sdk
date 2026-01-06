---
"@tinycloudlabs/node-sdk": patch
---

Fix delegation chain support for user-to-user delegations

- Added `pkhDid` getter for PKH DID format (`did:pkh:eip155:{chainId}:{address}`)
- Fixed `createDelegation` to use `delegateUri` for targeting recipient's PKH DID
- Fixed `createSubDelegation` to use `delegateUri` instead of generating random JWK
- Fixed sub-delegation expiry to cap at parent's expiry instead of throwing error
- Updated demo to use `pkhDid` for all delegations

Full delegation chain now works: Alice → Bob → Charlie
