/**
 * `@tinycloud/sdk-core/policy-access`
 *
 * Application-facing APIs for the accountless, policy-gated read:
 *
 * 0. (sender) publish the owner-signed policy to the standalone Policy Engine
 *    through its own registration contract (`POST /policy/v0/signed-objects`);
 * 1. mint an ephemeral holder/session key in the browser;
 * 2. acquire an exact-claim credential from OpenCredentials over the simple
 *    delivered-email/OTP flow — no wallet, no account, no OpenKey identity;
 * 3. present that credential plus holder proof **directly** to the standalone
 *    Policy Engine (`/policy/v0/challenge` → `/policy/v0/resolve`);
 * 4. import the short-lived, holder-bound delegation into the owner's generic
 *    TinyCloud Node (`/delegate`) and read ciphertext through `/invoke`;
 * 5. decrypt locally.
 *
 * TinyCloud Node stays a generic capability/storage enforcer throughout: this
 * module never calls an application-specific node route, and the transport
 * refuses `/share/*` paths outright.
 *
 * @packageDocumentation
 */

export {
  POLICY_ACCESS_ERROR_CODES,
  PolicyAccessError,
  type PolicyAccessErrorCode,
} from "./errors";

export {
  ED25519_JCS_SUITE,
  GRANT_PRESENTATION_V0_DOMAIN,
  createEphemeralHolderKey,
  didKeyFromEd25519PublicKey,
  grantPresentationDigest,
  type CreateEphemeralHolderKeyOptions,
  type EphemeralHolderKey,
} from "./holder";

export {
  DEFAULT_FORBIDDEN_PATH_PREFIXES,
  createFetchPolicyAccessTransport,
  type CreateFetchPolicyAccessTransportOptions,
  type PolicyAccessHttpRequest,
  type PolicyAccessHttpResponse,
  type PolicyAccessOriginPolicy,
  type PolicyAccessTransport,
} from "./transport";

export {
  EMAIL_CREDENTIAL_PROFILE,
  MAILBOX_OTP_STEP,
  beginEmailCredentialAcquisition,
  type AcquiredCredential,
  type EmailCredentialAcquisition,
  type EmailCredentialAcquisitionOptions,
} from "./credential";

export {
  EPHEMERAL_HOLDER_BINDING,
  GRANT_CHALLENGE_V0_SCHEMA,
  GRANT_PRESENTATION_V0_SCHEMA,
  POLICY_ACCESS_PROTOCOL,
  assertExactReadOnlyCapabilities,
  openPolicyAccess,
  parsePolicyAccessDelegation,
  requestPolicyAccessGrant,
  requestedCapabilitiesHashHex,
  type OpenPolicyAccessOptions,
  type PolicyAccessDescriptor,
  type PolicyAccessEvidence,
  type PolicyAccessGrant,
  type PolicyAccessReadResult,
  type PolicyAccessSession,
} from "./access";

export {
  POLICY_REGISTRATION_PATH,
  REGISTRABLE_SIGNED_OBJECT_SCHEMAS,
  publishSignedPolicyObjects,
  type PublishSignedPolicyObjectsInput,
  type PublishSignedPolicyObjectsResult,
} from "./publish";

export { decryptLocally, type LocalDecryptInput } from "./decrypt";

export {
  CREDENTIAL_INVITATION_PATH,
  CREDENTIAL_INVITATION_REQUEST_SCHEMA,
  DELIVERY_ADMISSION_PATH,
  DELIVERY_ADMISSION_REQUEST_SCHEMA,
  DELIVERY_ADMISSION_SCHEMA,
  requestCredentialInvitationDelivery,
  type CredentialInvitationDeliveryResult,
  type DeliveryAdmission,
  type RequestCredentialInvitationInput,
} from "./invitation";

export {
  GENERIC_DELEGATION_IMPORT_PATH,
  POLICY_PARENT_REGISTRATION_PATH,
  registerPolicyParentDelegation,
  type PolicyParentCapability,
  type RegisterPolicyParentDelegationInput,
} from "./parent";
