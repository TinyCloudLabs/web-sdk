---
"@tinycloud/sdk-core": minor
---

Add the sender half of the policy-access flow.

`publishSignedPolicyObjects` (from `@tinycloud/sdk-core/policy-access`) posts
owner-signed objects to a running Policy Engine's `POST
/policy/v0/signed-objects` route. Until now the reader APIs assumed the engine
already knew the policy, and the only way in was the engine's boot-time
`signedObjects` load — so an application that minted a policy while the engine
was running had nowhere to put it, and published to some other service instead.

`createAndSignOperationalKeyAuthorization` (from `@tinycloud/sdk-core/policy`)
completes the authority chain an owner needs to publish: the engine only honours
a `PolicyEngineRecord` naming a grant issuer if the same owner separately
authorised that key for the `grant-issuer` role. The new object family is
covered by the engine's own canonical signed-object vectors, so the TypeScript
JCS bytes, digest domain, and content-addressed id are checked against the Rust
implementation rather than against themselves.
