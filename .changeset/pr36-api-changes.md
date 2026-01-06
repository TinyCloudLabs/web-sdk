---
"@tinycloudlabs/node-sdk": minor
"@tinycloudlabs/web-sdk": patch
---

Breaking API changes for node-sdk delegation system

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
