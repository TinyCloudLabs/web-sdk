---
"@tinycloud/sdk-core": minor
"@tinycloud/web-sdk": minor
"@tinycloud/node-sdk": minor
---

Add public space support for discoverable, unauthenticated data publishing

- `makePublicSpaceId(address, chainId)` utility for deterministic public space ID construction
- `TinyCloud.ensurePublicSpace()` creates the user's public space on first need
- `TinyCloud.publicKV` getter returns IKVService scoped to the user's public space
- `TinyCloud.readPublicSpace(host, spaceId, key)` static method for unauthenticated reads
- `TinyCloud.readPublicKey(host, address, chainId, key)` static convenience method
