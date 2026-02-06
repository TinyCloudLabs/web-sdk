---
"@tinycloud/web-sdk": patch
---

Fix space-not-found race condition during sign-in. Both auth paths could complete signIn() without the space being active on the server, causing immediate "Space not found" errors from KV operations. Legacy path no longer silently swallows ensureSpaceExists() errors. New auth path throws when space creation modal is dismissed instead of returning silently.
