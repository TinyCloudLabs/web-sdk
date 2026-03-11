---
"@tinycloud/sdk-services": minor
---

Add storage quota error handling and TinyCloudBilling helper. New error codes `STORAGE_QUOTA_EXCEEDED` (402) and `STORAGE_LIMIT_REACHED` (413) with quota info parsing in KVService. New `TinyCloudBilling` class for Stripe checkout, subscription status, and customer portal flows.
