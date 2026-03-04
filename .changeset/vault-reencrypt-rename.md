---
"@tinycloud/sdk-services": minor
---

Add vault.reencrypt() method as the preferred name for vault.grant(). The grant() method is now a deprecated alias that delegates to reencrypt(). Internal revoke() also uses reencrypt().
