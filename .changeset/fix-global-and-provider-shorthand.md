---
"@tinycloud/web-sdk": patch
---

Fix `global is not defined` browser error by defining global as globalThis via webpack DefinePlugin. Add `provider` shorthand to Config as alternative to `providers: { web3: { driver } }`.
