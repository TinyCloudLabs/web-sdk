---
"@tinycloud/web-sdk": major
"@tinycloud/node-sdk": minor
"@tinycloud/sdk-core": minor
---

Unify web-sdk and node-sdk: TinyCloudWeb is now a thin wrapper around TinyCloudNode.

Breaking changes (web-sdk):
- `@tinycloud/web-core` package deleted — import types from `@tinycloud/sdk-core` or `@tinycloud/web-sdk`
- `WebUserAuthorization` class removed — use `tcw.session()`, `tcw.did`, `tcw.address()` instead
- `tcw.webAuth` and `tcw.userAuthorization` accessors removed
- `WebSignStrategy` / `WalletPopupStrategy` types removed

New in node-sdk:
- `signer`, `wasmBindings`, `notificationHandler`, `ensResolver`, `spaceCreationHandler` config options
- `connectSigner()` method for injecting any ISigner
- `@tinycloud/node-sdk/core` entry point (zero Node WASM deps, for browser bundlers)
- `restoreSession()` now initializes Vault

New in sdk-core:
- `INotificationHandler`, `IENSResolver`, `IWasmBindings`, `ISessionManager` interfaces
- `ClientSession`, `SiweConfig`, `EnsData` types (moved from web-core)

New in web-sdk:
- `sql`, `duckdb` services now available
- Browser adapters: `BrowserWalletSigner`, `BrowserSessionStorage`, `BrowserNotificationHandler`, `BrowserWasmBindings`, `BrowserENSResolver`
- ENS name resolution in delegation methods
