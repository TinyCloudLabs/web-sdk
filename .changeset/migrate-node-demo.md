---
"@tinycloudlabs/node-demo": patch
---

Migrate node-demo to use new node-sdk package.

Changes:
- Add sdk-core and node-sdk dependencies
- Refactor demo.ts to use NodeUserAuthorization and PrivateKeySigner
- Rename original demo to demo-legacy.ts for reference
- Demonstrate all sign strategies (auto-sign, callback, event-emitter, auto-reject)

Part of TC-401: IUserAuthorization shared interface implementation.
