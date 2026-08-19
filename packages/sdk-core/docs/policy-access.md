# `@tinycloud/sdk-core/policy-access`

Read a policy-gated, encrypted TinyCloud resource in a browser **without the
reader having a TinyCloud account, a wallet, or any external identity**.

Share is the first consumer, but nothing here imports Share: the module works
for any app whose owner has published a policy over an encrypted resource.

## The shape of the flow

```
browser                    OpenCredentials         Policy Engine        TinyCloud Node
   |                             |                       |                     |
   |-- ephemeral holder key      |                       |                     |
   |-- POST /v1/acquisitions --->|                       |                     |
   |<-- OTP by email ------------|                       |                     |
   |-- POST .../proof (otp) ---->|                       |                     |
   |-- sign holder binding ----->|                       |                     |
   |<-- vc+sd-jwt credential ----|                       |                     |
   |                                                     |                     |
   |------------------ POST /policy/v0/challenge ------->|                     |
   |<----------------- audience-bound nonce -------------|                     |
   |-- sign GrantPresentation with the ephemeral key     |                     |
   |------------------ POST /policy/v0/resolve --------->|                     |
   |<----------------- short-lived holder-bound UCAN ----|                     |
   |                                                                           |
   |-------------------------- POST /delegate -------------------------------->|
   |-------------------------- POST /invoke ---------------------------------->|
   |<------------------------- ciphertext -------------------------------------|
   |-- decrypt locally                                                          |
```

Two properties are load-bearing:

- **TinyCloud Node is a generic capability/storage enforcer.** It never sees a
  credential, an email address, a policy decision, or a content key. The
  built-in transport refuses any `/share/*` path outright.
- **The recipient never touches an identity provider.** No OpenKey call, no
  wallet popup, no redirect. The only key involved is the ephemeral one this
  module mints, and it dies with the tab.

## Quick start

```ts
import {
  beginEmailCredentialAcquisition,
  createEphemeralHolderKey,
  createFetchPolicyAccessTransport,
  decryptLocally,
  openPolicyAccess,
} from "@tinycloud/sdk-core/policy-access";

// 1. Mint a tab-scoped holder key. Nothing persists it.
const holder = createEphemeralHolderKey();

// 2. Pin every origin this flow may contact. Build this from YOUR config,
//    never from bytes that arrived in the invitation link.
const transport = createFetchPolicyAccessTransport({
  originPolicy: {
    allowedOrigins: [issuerOrigin, policyEngineEndpoint, ownerNodeEndpoint],
  },
});

// 3. Prove control of the mailbox. Two steps, no account.
const acquisition = await beginEmailCredentialAcquisition({
  issuerOrigin,
  transport,
  holder,
  email: recipientEmail,
  requirement,           // createEmailCredentialRequirement(...)
  descriptor,            // the issuer's published flow descriptor
  audience: "tinycloud://credentials",
  openerOrigin: location.origin,
  completionOrigin: location.origin,
  completionContext: "my-app-receiver",
});
await acquisition.requestOtp();
const credential = await acquisition.submitOtp(codeFromTheEmail);

// 4. Present directly to the Policy Engine and import the grant into the node.
const session = await openPolicyAccess({
  descriptor: {
    policyId,
    policyEngine: { endpoint: policyEngineEndpoint, audience, grantIssuerDid },
    ownerNode: { endpoint: ownerNodeEndpoint, spaceId },
    requestedCapabilities: [
      {
        service: "tinycloud.kv",
        space: capabilitySpace,
        path: resourcePath,
        actions: ["tinycloud.kv/get"],   // read-only, exact resource
      },
    ],
  },
  holder,
  transport,
  evidence: [
    { requirementId, presentation: { sdJwt: credential.credential } },
  ],
  invoke,                 // from @tinycloud/web-sdk (WASM invocation signer)
});

// 5. Read ciphertext, then decrypt in the browser.
const { ciphertext } = await session.readEncrypted(resourcePath);
const plaintext = await decryptLocally({
  ciphertext,
  key: contentKey,        // unwrapped locally; no service ever sees it
  versionByte: 0x01,
});
```

## What the module enforces for you

`openPolicyAccess` refuses to continue when any of these fail. All of them are
*additional* to the Policy Engine's own checks — the engine remains
authoritative, this is caller-side defence in depth.

| Check | Error code |
| --- | --- |
| requested actions are read-only (`kv/get`, `sql/read`) | `capability-not-read-only` |
| requested path is exact, never a prefix | `capability-not-exact-resource` |
| challenge `policyId`/`audience` match the pinned descriptor | `challenge-binding-mismatch` |
| engine accepts the holder's signature suite | `engine-response-invalid` |
| delegation is bound to *this* ephemeral key | `delegation-wrong-holder` |
| delegation issuer is the configured grant issuer | `delegation-wrong-issuer` |
| delegation is `terminal` (not re-delegatable) | `delegation-not-terminal` |
| delegation TTL is inside the 300s ceiling | `delegation-ttl-excessive` |
| delegation grants nothing wider than requested | `delegation-capability-wider` |
| node activated the delegation for the target space | `delegation-import-failed` |
| read target is covered exactly by the grant | `read-not-contained` |
| grant has not expired | `session-expired` |
| egress origin is on the pinned allowlist | `origin-not-allowed` |

Delegation authority is derived **only** from the signed compact-JWS UCAN.
The JSON envelope around it is never trusted.

## Presentation binding

The `GrantPresentation` this module signs is bound to, and unusable outside of:

- the engine's `audience`;
- a single engine-issued `nonce` (the engine consumes it whether the resolve
  succeeds or fails, so a replay is a distinct request);
- the recipient's own `expiresAt`, separate from the challenge's expiry;
- the exact `requestedCapabilities`, committed through
  `requestedCapabilitiesHash`;
- the ephemeral holder key, via `holderSignature` over
  `SHA-256("xyz.tinycloud.policy/GrantPresentation/v0\0" || JCS(body))`.

For an accountless recipient the `holderBinding` is
`{"type":"ephemeral-holder"}`: the ephemeral key *is* the credential subject, so
`eligibleSubjectDid` must equal `holderDid`. The engine additionally refuses
this binding on any policy that carries no evidence atoms. See the policy-engine
spec `spec/accountless-holder-binding.md`.

Apps that do hold an owner-signed `HolderEnrollment` can pass their own
`holderBinding` and `eligibleSubjectDid` instead; the rest of the flow is
identical.

## Conformance

`test-fixtures/policy-access/ephemeral-holder-presentation.json` is a frozen
presentation signed by this module. The policy engine verifies those exact
bytes in `tests/accountless_holder_conformance.rs`, and both repositories pin
the same SHA-256, so an encoding drift breaks a test on both sides.
