---
"@tinycloud/sdk-services": minor
"@tinycloud/sdk-core": minor
"@tinycloud/node-sdk": minor
---

Add SQL service (tinycloud.sql/*) with full TypeScript SDK support

- New SQLService in sdk-services: query, execute, batch, executeStatement, export
- DatabaseHandle for per-database operations
- SQL re-exports in sdk-core with TinyCloud.sql getter
- Node-SDK: SQL wiring in TinyCloudNode, DelegatedAccess, root delegation defaults
- Fix type-only re-exports preventing bun runtime resolution
