---
"@tinycloud/cli": minor
"@tinycloud/node-sdk": minor
---

Add browser-based delegate auth flow for CLI login via OpenKey. The CLI opens a `/delegate` page where users authenticate with a passkey, select a key, and approve a delegation. `TinyCloudNode.restoreSession()` allows injecting stored delegation data without a private key. Also fixes `kv list` result parsing and CLI process hang after auth.
