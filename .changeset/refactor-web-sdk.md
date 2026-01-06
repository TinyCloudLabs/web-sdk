---
"@tinycloudlabs/web-sdk": patch
---

Refactor web-sdk to use shared sdk-core interfaces.

Changes:
- Add sdk-core dependency
- UserAuthorization now implements IUserAuthorization from sdk-core
- Re-export sdk-core interfaces (TinyCloud, ISigner, ISessionStorage, etc.)
- Web-sdk can now be used with platform-agnostic sdk-core code

Part of TC-401: IUserAuthorization shared interface implementation.
