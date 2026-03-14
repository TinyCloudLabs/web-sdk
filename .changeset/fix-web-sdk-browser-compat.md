---
"@tinycloud/web-sdk": patch
---

Fix browser runtime errors (exports is not defined, utils.inherits is not a function) by setting webpack target to web, disabling Node.js shims, and using source-map instead of eval-source-map
