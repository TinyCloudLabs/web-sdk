import { sha256 } from "@noble/hashes/sha256";
import { encodeBase64Url } from "../credentials/digest";
import { jcsCanonicalize } from "../policy";
import { PolicyAccessError } from "./errors";
import type { PolicyAccessTransport } from "./transport";

export const DELIVERY_ADMISSION_PATH = "/policy/v0/delivery-admissions" as const;
export const CREDENTIAL_INVITATION_PATH = "/v1/credential-invitations" as const;
export const DELIVERY_ADMISSION_REQUEST_SCHEMA =
  "xyz.tinycloud.policy/delivery-admission-request/v0" as const;
export const DELIVERY_ADMISSION_SCHEMA =
  "xyz.tinycloud.policy/delivery-admission/v0" as const;
export const CREDENTIAL_INVITATION_REQUEST_SCHEMA =
  "xyz.tinycloud.credentials/invitation-request/v1" as const;

const ADMISSION_REQUEST_DOMAIN =
  "xyz.tinycloud.policy/delivery-admission-request/v0\0";
const INVITATION_REQUEST_DOMAIN =
  "xyz.tinycloud.credentials/invitation-request/v1\0";
const SIGNATURE_SUITE = "eddsa-ed25519-sha256-jcs-v1" as const;
const MAX_TTL_SECONDS = 15 * 60;
const encoder = new TextEncoder();

interface ContractSignature {
  readonly suite: typeof SIGNATURE_SUITE;
  readonly signerDid: string;
  readonly value: string;
}

export interface DeliveryAdmission {
  readonly schema: typeof DELIVERY_ADMISSION_SCHEMA;
  readonly policyId: string;
  readonly ownerDid: string;
  readonly recipient: string;
  readonly resource: string;
  readonly actions: readonly ["tinycloud.kv/get"];
  readonly credentialType: string;
  readonly returnLink: string;
  readonly envelopeRef: string;
  readonly senderKeyDid: string;
  readonly audience: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly signature: ContractSignature;
}

export interface RequestCredentialInvitationInput {
  readonly policyEngineEndpoint: string;
  readonly deliveryEndpoint: string;
  readonly policyId: string;
  readonly resource: string;
  readonly credentialType: string;
  readonly returnLink: string;
  readonly envelopeRef: string;
  readonly audience: string;
  readonly signerDid: string;
  readonly signDigest: (digest: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  readonly transport: PolicyAccessTransport;
  /** Stable 16-byte base64url idempotency key. Generated when omitted. */
  readonly nonce?: string;
  readonly now?: Date;
  readonly ttlSeconds?: number;
}

export interface CredentialInvitationDeliveryResult {
  readonly status: "accepted";
  readonly admission: DeliveryAdmission;
}

function exactOrigin(value: string, label: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PolicyAccessError("access-descriptor-invalid", `${label} must be an absolute origin`);
  }
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (
    (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
    parsed.username !== "" || parsed.password !== undefined && parsed.password !== "" ||
    parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== ""
  ) {
    throw new PolicyAccessError("access-descriptor-invalid", `${label} must be a canonical HTTPS origin`);
  }
  return parsed.origin;
}

function bounded(value: string, label: string, max = 256): void {
  if (value.length === 0 || value.length > max || !/^[\x20-\x7e]+$/.test(value)) {
    throw new PolicyAccessError("access-descriptor-invalid", `${label} is invalid`);
  }
}

function nonce16(value: string | undefined): string {
  if (value !== undefined) {
    if (!/^[A-Za-z0-9_-]{22}$/.test(value)) {
      throw new PolicyAccessError("access-descriptor-invalid", "invitation nonce must encode 16 bytes");
    }
    return value;
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function contractTime(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

function digest(domain: string, value: unknown): Uint8Array {
  return sha256(encoder.encode(`${domain}${jcsCanonicalize(value)}`));
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function parseAdmission(value: unknown, expected: Record<string, string>): DeliveryAdmission {
  const body = object(value);
  const signature = object(body?.signature);
  if (
    body?.schema !== DELIVERY_ADMISSION_SCHEMA ||
    body.policyId !== expected.policyId || body.resource !== expected.resource ||
    body.credentialType !== expected.credentialType || body.returnLink !== expected.returnLink ||
    body.envelopeRef !== expected.envelopeRef || body.audience !== expected.audience ||
    body.issuedAt !== expected.issuedAt || body.expiresAt !== expected.expiresAt ||
    body.nonce !== expected.nonce || body.senderKeyDid !== expected.signerDid ||
    typeof body.ownerDid !== "string" || typeof body.recipient !== "string" ||
    !Array.isArray(body.actions) || body.actions.length !== 1 || body.actions[0] !== "tinycloud.kv/get" ||
    signature?.suite !== SIGNATURE_SUITE || typeof signature.signerDid !== "string" ||
    typeof signature.value !== "string"
  ) {
    throw new PolicyAccessError("engine-response-invalid", "policy engine returned an invalid delivery admission");
  }
  return body as unknown as DeliveryAdmission;
}

/**
 * Ask the Policy Engine to attest the registered exact-recipient policy, then
 * authorize one generic credential-acquisition invitation with the same key.
 */
export async function requestCredentialInvitationDelivery(
  input: RequestCredentialInvitationInput,
): Promise<CredentialInvitationDeliveryResult> {
  const policyEngineOrigin = exactOrigin(input.policyEngineEndpoint, "policy engine endpoint");
  const deliveryOrigin = exactOrigin(input.deliveryEndpoint, "credential delivery endpoint");
  bounded(input.policyId, "policy id");
  bounded(input.resource, "resource");
  bounded(input.credentialType, "credential type");
  bounded(input.envelopeRef, "envelope reference");
  bounded(input.signerDid, "signer DID");
  const returnLink = new URL(input.returnLink);
  if (returnLink.protocol !== "https:" && !(returnLink.protocol === "http:" && ["localhost", "127.0.0.1"].includes(returnLink.hostname))) {
    throw new PolicyAccessError("access-descriptor-invalid", "invitation return link must use HTTPS");
  }
  if (returnLink.username !== "" || returnLink.password !== "") {
    throw new PolicyAccessError("access-descriptor-invalid", "invitation return link must not contain credentials");
  }
  if (exactOrigin(input.audience, "invitation audience") !== deliveryOrigin) {
    throw new PolicyAccessError("access-descriptor-invalid", "invitation audience must equal the delivery endpoint");
  }
  const ttl = input.ttlSeconds ?? 300;
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_SECONDS) {
    throw new PolicyAccessError("access-descriptor-invalid", "invitation TTL must be between 1 and 900 seconds");
  }
  const issuedAt = contractTime(input.now ?? new Date());
  const expiresAt = contractTime(new Date(Date.parse(issuedAt) + ttl * 1000));
  const nonce = nonce16(input.nonce);
  const unsignedAdmissionRequest = {
    schema: DELIVERY_ADMISSION_REQUEST_SCHEMA,
    policyId: input.policyId,
    resource: input.resource,
    credentialType: input.credentialType,
    returnLink: input.returnLink,
    envelopeRef: input.envelopeRef,
    audience: deliveryOrigin,
    issuedAt,
    expiresAt,
    nonce,
  };
  const admissionRequest = {
    ...unsignedAdmissionRequest,
    signature: {
      suite: SIGNATURE_SUITE,
      signerDid: input.signerDid,
      value: encodeBase64Url(await input.signDigest(digest(ADMISSION_REQUEST_DOMAIN, unsignedAdmissionRequest))),
    },
  };
  const admissionResponse = await input.transport.request({
    method: "POST",
    url: `${policyEngineOrigin}${DELIVERY_ADMISSION_PATH}`,
    body: { request: admissionRequest },
  });
  if (admissionResponse.status !== 200 || admissionResponse.finalUrl !== `${policyEngineOrigin}${DELIVERY_ADMISSION_PATH}`) {
    throw new PolicyAccessError("engine-denied", "policy engine refused the invitation admission", { status: admissionResponse.status });
  }
  const admission = parseAdmission(object(admissionResponse.body)?.admission, { ...unsignedAdmissionRequest, signerDid: input.signerDid });
  const request = {
    schema: CREDENTIAL_INVITATION_REQUEST_SCHEMA,
    policyId: admission.policyId,
    recipient: admission.recipient,
    resource: admission.resource,
    credentialType: admission.credentialType,
    returnLink: admission.returnLink,
    envelopeRef: admission.envelopeRef,
    audience: admission.audience,
    issuedAt: admission.issuedAt,
    expiresAt: admission.expiresAt,
    nonce: admission.nonce,
  };
  const deliveryResponse = await input.transport.request({
    method: "POST",
    url: `${deliveryOrigin}${CREDENTIAL_INVITATION_PATH}`,
    body: {
      request,
      admission,
      proof: {
        alg: "EdDSA",
        kid: input.signerDid,
        signature: encodeBase64Url(await input.signDigest(digest(INVITATION_REQUEST_DOMAIN, request))),
      },
    },
  });
  if (
    deliveryResponse.status !== 202 ||
    deliveryResponse.finalUrl !== `${deliveryOrigin}${CREDENTIAL_INVITATION_PATH}` ||
    object(deliveryResponse.body)?.status !== "accepted"
  ) {
    throw new PolicyAccessError("engine-denied", "credential invitation delivery was not accepted", { status: deliveryResponse.status });
  }
  return { status: "accepted", admission };
}
