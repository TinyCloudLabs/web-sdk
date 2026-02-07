---
"@tinycloud/web-sdk": minor
---

Remove legacy UserAuthorization, make WebUserAuthorization the default

- Remove `useNewAuth` config flag — `WebUserAuthorization` is now always used
- Delete legacy `UserAuthorization` class (1,231 lines)
- Remove `isNewAuthEnabled` getter and all legacy mode guards
- Auth modes simplified from legacy/new-wallet/new-session-only to wallet/session-only
