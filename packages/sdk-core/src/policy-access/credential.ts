import {
  CREDENTIAL_ACQUISITION_PROTOCOL,
  canonicalDigest,
  credentialEndpointPath,
  credentialRequirementDigest,
  encodeBase64Url,
  holderBindingSigningBytes,
  sha256Base64Url,
  validateCredentialFlowDescriptor,
  validateCredentialHolderBinding,
  type CredentialFlowDescriptor,
  type CredentialRequirement,
} from "../credentials";
import { PolicyAccessError } from "./errors";
import type { EphemeralHolderKey } from "./holder";
import type { PolicyAccessTransport } from "./transport";

export const EMAIL_CREDENTIAL_PROFILE = "tinycloud.email-proof/v1" as const;
export const MAILBOX_OTP_STEP = "mailbox_otp" as const;

/**
 * The credential an OpenCredentials acquisition produced, together with the
 * exact bytes the Policy Engine needs as evidence. Nothing here is
 * Share-specific: any application that gates on "the recipient controls this
 * mailbox" can present it.
 */
export interface AcquiredCredential {
  readonly requestId: string;
  readonly format: "vc+sd-jwt";
  readonly credential: string;
  readonly credentialDigest: string;
  /** did:key of the ephemeral holder — the credential subject. */
  readonly subject: string;
  readonly issuer: string;
  readonly issuerKid: string;
  readonly claims: Readonly<Record<string, string>>;
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** The signed holder binding, presented verbatim to the Policy Engine. */
  readonly holderBinding: unknown;
}

export interface EmailCredentialAcquisitionOptions {
  /** OpenCredentials issuer origin, from trusted app configuration. */
  readonly issuerOrigin: string;
  readonly transport: PolicyAccessTransport;
  readonly holder: EphemeralHolderKey;
  /** The exact recipient address the share was addressed to. */
  readonly email: string;
  readonly requirement: CredentialRequirement;
  readonly descriptor: CredentialFlowDescriptor;
  readonly audience: string;
  readonly openerOrigin: string;
  readonly completionOrigin: string;
  readonly completionContext: string;
  /**
   * 43-character base64url secret held only by this tab. Its digest is
   * committed at request creation and the raw value authenticates every later
   * step, so an attacker who observes the request id cannot drive the flow.
   */
  readonly completionVerifier?: string;
}

/**
 * A live email/OTP acquisition. The recipient completes exactly two steps:
 * receive a code by email and enter it. No wallet, no account, no external
 * identity provider is involved at any point.
 */
export interface EmailCredentialAcquisition {
  readonly requestId: string;
  /** Ask the issuer to deliver a one-time code to the pinned address. */
  requestOtp(): Promise<{ readonly challengeNonce: string }>;
  /**
   * Submit the delivered code, sign the holder binding with the ephemeral key,
   * and collect the issued credential.
   */
  submitOtp(otp: string): Promise<AcquiredCredential>;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function requireOk(
  status: number,
  body: unknown,
  expected: readonly number[],
  what: string,
): void {
  if (expected.includes(status)) return;
  const error = asRecord(body)?.error ?? asRecord(body)?.code;
  throw new PolicyAccessError(
    status === 401 || status === 403 || status === 409
      ? "credential-denied"
      : "credential-response-invalid",
    `${what} failed with status ${status}${
      typeof error === "string" ? `: ${error}` : ""
    }`,
    { status },
  );
}

/**
 * Drive the OpenCredentials delivered-email/OTP acquisition against the
 * standalone issuer. This is the only credential path a policy-gated
 * recipient needs, and it never touches an OpenKey identity.
 */
export async function beginEmailCredentialAcquisition(
  options: EmailCredentialAcquisitionOptions,
): Promise<EmailCredentialAcquisition> {
  const descriptor = validateCredentialFlowDescriptor(options.descriptor);
  if (descriptor.profile !== EMAIL_CREDENTIAL_PROFILE) {
    throw new PolicyAccessError(
      "access-descriptor-invalid",
      `expected the ${EMAIL_CREDENTIAL_PROFILE} descriptor, got ${descriptor.profile}`,
    );
  }
  const origin = trimTrailingSlash(options.issuerOrigin);
  const verifier = options.completionVerifier ?? randomVerifier();
  const bearer = { Authorization: `Bearer ${verifier}` };

  const created = await options.transport.request({
    method: "POST",
    url: `${origin}${credentialEndpointPath("request")}`,
    body: {
      protocol: CREDENTIAL_ACQUISITION_PROTOCOL,
      profile: descriptor.profile,
      profileVersion: 1,
      descriptorDigest: await canonicalDigest(descriptor),
      requirementDigest: await credentialRequirementDigest(
        options.requirement,
      ),
      holderDid: options.holder.did,
      inputs: { email: options.email },
      audience: options.audience,
      openerOrigin: options.openerOrigin,
      completionOrigin: options.completionOrigin,
      completionContext: options.completionContext,
      completionVerifierChallenge: await sha256Base64Url(verifier),
    },
  });
  requireOk(created.status, created.body, [200, 201], "acquisition create");
  const requestId = asRecord(created.body)?.requestId;
  if (typeof requestId !== "string" || requestId.length === 0) {
    throw new PolicyAccessError(
      "credential-response-invalid",
      "acquisition create returned no requestId",
    );
  }

  return {
    requestId,
    async requestOtp() {
      const response = await options.transport.request({
        method: "POST",
        url: `${origin}${credentialEndpointPath("challenge", requestId)}`,
        headers: bearer,
        body: { step: MAILBOX_OTP_STEP, stepVersion: 1 },
      });
      requireOk(response.status, response.body, [200, 201], "otp challenge");
      const nonce = asRecord(response.body)?.challengeNonce;
      if (typeof nonce !== "string" || nonce.length === 0) {
        throw new PolicyAccessError(
          "credential-response-invalid",
          "otp challenge returned no challengeNonce",
        );
      }
      return { challengeNonce: nonce };
    },
    async submitOtp(otp: string) {
      const state = await options.transport.request({
        method: "GET",
        url: `${origin}${credentialEndpointPath("state", requestId)}`,
        headers: bearer,
      });
      requireOk(state.status, state.body, [200], "acquisition state");
      const challengeNonce = asRecord(state.body)?.challengeNonce;
      if (typeof challengeNonce !== "string") {
        throw new PolicyAccessError(
          "credential-response-invalid",
          "acquisition state has no live challengeNonce for the otp step",
        );
      }
      const proof = await options.transport.request({
        method: "POST",
        url: `${origin}${credentialEndpointPath("proof", requestId)}`,
        headers: bearer,
        body: {
          step: MAILBOX_OTP_STEP,
          stepVersion: 1,
          challengeNonce,
          proof: { otp },
        },
      });
      requireOk(proof.status, proof.body, [200], "otp proof");

      const bindingResponse = await options.transport.request({
        method: "GET",
        url: `${origin}${credentialEndpointPath("holder_binding", requestId)}`,
        headers: bearer,
      });
      requireOk(
        bindingResponse.status,
        bindingResponse.body,
        [200],
        "holder binding",
      );
      const rawBinding = asRecord(bindingResponse.body)?.binding;
      const binding = validateCredentialHolderBinding(rawBinding);
      if (binding.holderDid !== options.holder.did) {
        throw new PolicyAccessError(
          "credential-subject-mismatch",
          "issuer bound the credential to a different holder key",
        );
      }
      const signature = encodeBase64Url(
        options.holder.sign(holderBindingSigningBytes(binding)),
      );
      const signed = await options.transport.request({
        method: "POST",
        url: `${origin}${credentialEndpointPath(
          "holder_signature",
          requestId,
        )}`,
        headers: bearer,
        body: {
          alg: "EdDSA",
          kid: options.holder.keyId,
          signature,
        },
      });
      requireOk(signed.status, signed.body, [200], "holder signature");

      const issued = await options.transport.request({
        method: "POST",
        url: `${origin}${credentialEndpointPath("issue", requestId)}`,
        headers: bearer,
      });
      requireOk(issued.status, issued.body, [200, 201], "credential issue");

      const result = await options.transport.request({
        method: "GET",
        url: `${origin}${credentialEndpointPath("result", requestId)}`,
        headers: bearer,
      });
      requireOk(result.status, result.body, [200], "credential result");
      const value = asRecord(result.body);
      if (
        value === undefined ||
        typeof value.credential !== "string" ||
        value.format !== "vc+sd-jwt" ||
        typeof value.credentialDigest !== "string" ||
        typeof value.issuer !== "string" ||
        typeof value.issuerKid !== "string"
      ) {
        throw new PolicyAccessError(
          "credential-response-invalid",
          "credential result is not a well-formed issuance",
        );
      }
      if (value.subject !== options.holder.did) {
        throw new PolicyAccessError(
          "credential-subject-mismatch",
          "issued credential subject is not the ephemeral holder key",
        );
      }
      const claims = asRecord(value.claims) ?? {};
      if (claims.email !== options.email) {
        throw new PolicyAccessError(
          "credential-subject-mismatch",
          "issued credential is not for the exact requested recipient address",
        );
      }
      return {
        requestId,
        format: "vc+sd-jwt",
        credential: value.credential,
        credentialDigest: value.credentialDigest,
        subject: options.holder.did,
        issuer: value.issuer,
        issuerKid: value.issuerKid,
        claims: claims as Readonly<Record<string, string>>,
        issuedAt: String(value.issuedAt ?? binding.issuedAt),
        expiresAt: String(value.expiresAt ?? binding.expiresAt),
        holderBinding: binding,
      };
    },
  };
}
