import { sha256 } from "@noble/hashes/sha256";
import type {
  InvokeFunction,
  ServiceHeaders,
  ServiceSession,
} from "@tinycloud/sdk-services";
import {
  jcsCanonicalize,
  normalizePolicyCapability,
  policyCapabilityContains,
  type PolicyCapability,
} from "../policy";
import {
  deriveDelegationCid,
  parseNodeNativePortableDelegation,
  type PortableDelegation,
} from "../requester";
import { PolicyAccessError } from "./errors";
import type { EphemeralHolderKey } from "./holder";
import type { PolicyAccessTransport } from "./transport";

export const POLICY_ACCESS_PROTOCOL = "xyz.tinycloud.policy-access/v1" as const;
export const GRANT_CHALLENGE_V0_SCHEMA =
  "xyz.tinycloud.policy/challenge/v0" as const;
export const GRANT_PRESENTATION_V0_SCHEMA =
  "xyz.tinycloud.policy/presentation/v0" as const;

/**
 * Accountless holder-binding proof: the ephemeral key that signs the
 * presentation is itself the credential subject, so there is no owner-signed
 * enrollment anywhere in the flow. See policy-engine
 * `spec/accountless-holder-binding.md`.
 */
export const EPHEMERAL_HOLDER_BINDING = Object.freeze({
  type: "ephemeral-holder",
} as const);

const textEncoder = new TextEncoder();

/** Read-only actions a policy-access session is permitted to request. */
const READ_ONLY_ACTIONS = new Set(["tinycloud.kv/get", "tinycloud.sql/read"]);

function bytesToHexLower(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * `requestedCapabilitiesHash` per policy-engine `spec/grant-presentation.md`
 * §2.3: bare lowercase hex SHA-256 over the domain-separated JCS encoding of
 * the capability array sorted by `(service, space, path)`.
 */
export function requestedCapabilitiesHashHex(
  capabilities: readonly PolicyCapability[],
): string {
  const canonical = [...capabilities].sort((left, right) =>
    `${left.service}\0${left.space}\0${left.path}`.localeCompare(
      `${right.service}\0${right.space}\0${right.path}`,
    ),
  );
  const domain = textEncoder.encode(
    "xyz.tinycloud.policy/RequestedCapabilities/v0\0",
  );
  const body = textEncoder.encode(jcsCanonicalize(canonical));
  const bytes = new Uint8Array(domain.length + body.length);
  bytes.set(domain, 0);
  bytes.set(body, domain.length);
  return bytesToHexLower(sha256(bytes));
}

/**
 * Everything a recipient needs to reach the Policy Engine and the owner's
 * TinyCloud Node. These fields are *trusted configuration*: an application
 * resolves them from its own deployment config or from an owner-signed
 * record it has independently verified — never from unverified invitation
 * bytes.
 */
export interface PolicyAccessDescriptor {
  readonly policyId: string;
  readonly policyEngine: {
    readonly endpoint: string;
    readonly audience: string;
    /** did:key of the engine's grant issuer, from verified configuration. */
    readonly grantIssuerDid: string;
  };
  readonly ownerNode: {
    readonly endpoint: string;
    readonly spaceId: string;
  };
  /** Exactly the capability the recipient is entitled to, read-only. */
  readonly requestedCapabilities: readonly PolicyCapability[];
}

/** Credential evidence presented to the Policy Engine, unchanged on the wire. */
export interface PolicyAccessEvidence {
  readonly requirementId: string;
  readonly presentation: unknown;
}

export interface OpenPolicyAccessOptions {
  readonly descriptor: PolicyAccessDescriptor;
  readonly holder: EphemeralHolderKey;
  readonly transport: PolicyAccessTransport;
  /**
   * The exact subject the policy must match. Defaults to the ephemeral holder
   * DID, which is what the accountless `ephemeral-holder` binding requires:
   * the key that proves possession IS the credential subject. Supply this only
   * when presenting on behalf of a separately enrolled subject.
   */
  readonly eligibleSubjectDid?: string;
  /**
   * Holder-binding proof. Defaults to the accountless
   * `{"type":"ephemeral-holder"}` binding. Pass an `enrolled-agent` proof
   * instead when the app does hold an owner-signed enrollment.
   */
  readonly holderBinding?: unknown;
  readonly evidence: readonly PolicyAccessEvidence[];
  /** Node invocation signer, injected by the platform SDK (WASM). */
  readonly invoke: InvokeFunction;
  readonly presentationTtlSeconds?: number;
  readonly now?: () => Date;
}

export interface PolicyAccessGrant {
  readonly delegation: PortableDelegation;
  readonly delegationCid: string;
  readonly nonce: string;
  readonly challengeId: string;
  readonly expiresAt: string;
}

export interface PolicyAccessReadResult {
  /** Ciphertext exactly as stored in TinyCloud. Decryption is local. */
  readonly ciphertext: Uint8Array;
  readonly resource: { readonly space: string; readonly path: string };
}

export interface PolicyAccessSession {
  readonly grant: PolicyAccessGrant;
  readonly holderDid: string;
  readonly expiresAt: string;
  /** Read one exact resource the grant covers. Never widens the request. */
  readEncrypted(path: string): Promise<PolicyAccessReadResult>;
  /** Whether the grant is still inside its short-lived window. */
  isActive(): boolean;
}

const DEFAULT_PRESENTATION_TTL_SECONDS = 60;
const MAX_DELEGATION_TTL_SECONDS = 300;

function rfc3339(date: Date): string {
  return date.toISOString().replace(".000Z", "Z");
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function engineDenial(
  status: number,
  body: unknown,
): PolicyAccessError {
  const error = asRecord(asRecord(body)?.error);
  const code = typeof error?.code === "string" ? error.code : undefined;
  return new PolicyAccessError(
    "engine-denied",
    `policy engine denied the presentation${code === undefined ? "" : `: ${code}`}`,
    { status, ...(code === undefined ? {} : { denialCode: code }) },
  );
}

/**
 * Reject anything wider than an exact, read-only resource before a single byte
 * leaves the browser. The Policy Engine enforces the real ceiling; this is a
 * caller-side guard so an app cannot accidentally ask for write authority.
 */
export function assertExactReadOnlyCapabilities(
  capabilities: readonly PolicyCapability[],
): readonly PolicyCapability[] {
  if (capabilities.length === 0) {
    throw new PolicyAccessError(
      "access-descriptor-invalid",
      "policy access requires at least one requested capability",
    );
  }
  return capabilities.map((capability) => {
    let normalized: PolicyCapability;
    try {
      normalized = normalizePolicyCapability(capability);
    } catch (error) {
      throw new PolicyAccessError(
        "capability-not-exact-resource",
        `requested capability is not a concrete read target: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    for (const action of normalized.actions) {
      if (!READ_ONLY_ACTIONS.has(action)) {
        throw new PolicyAccessError(
          "capability-not-read-only",
          `policy access refuses a non-read action: ${action}`,
        );
      }
    }
    if (normalized.path.endsWith("/") || normalized.path.length === 0) {
      throw new PolicyAccessError(
        "capability-not-exact-resource",
        `policy access requires an exact resource path, got "${normalized.path}"`,
      );
    }
    return normalized;
  });
}

/**
 * Acquire a short-lived, holder-bound delegation directly from the standalone
 * Policy Engine and import it into the owner's generic TinyCloud Node.
 *
 * The flow is exactly: `POST /policy/v0/challenge` → sign a nonce-bound,
 * audience-bound GrantPresentation with the ephemeral holder key →
 * `POST /policy/v0/resolve` → `POST /delegate` on the node. There is no
 * intermediary and no application-specific node route anywhere in the path.
 */
export async function requestPolicyAccessGrant(
  options: OpenPolicyAccessOptions,
): Promise<PolicyAccessGrant> {
  const { descriptor, holder, transport } = options;
  const now = options.now ?? (() => new Date());
  const capabilities = assertExactReadOnlyCapabilities(
    descriptor.requestedCapabilities,
  );

  const challengeResponse = await transport.request({
    method: "POST",
    url: `${trimTrailingSlash(descriptor.policyEngine.endpoint)}/policy/v0/challenge`,
    body: { policyId: descriptor.policyId },
  });
  if (challengeResponse.status !== 200) {
    throw engineDenial(challengeResponse.status, challengeResponse.body);
  }
  const challenge = asRecord(asRecord(challengeResponse.body)?.challenge);
  if (challenge === undefined) {
    throw new PolicyAccessError(
      "engine-response-invalid",
      "policy engine challenge response has no challenge object",
    );
  }
  if (
    challenge.schema !== GRANT_CHALLENGE_V0_SCHEMA ||
    typeof challenge.challengeId !== "string" ||
    typeof challenge.nonce !== "string" ||
    challenge.nonce.length < 16 ||
    typeof challenge.challengeExpiresAt !== "string" ||
    !Array.isArray(challenge.acceptedSuites)
  ) {
    throw new PolicyAccessError(
      "engine-response-invalid",
      "policy engine challenge is not a well-formed GrantChallenge/v0",
    );
  }
  if (
    challenge.policyId !== descriptor.policyId ||
    challenge.audience !== descriptor.policyEngine.audience
  ) {
    throw new PolicyAccessError(
      "challenge-binding-mismatch",
      "challenge policyId/audience does not match the pinned access descriptor",
    );
  }
  if (!challenge.acceptedSuites.includes(holder.suite)) {
    throw new PolicyAccessError(
      "engine-response-invalid",
      `policy engine does not accept the holder signature suite ${holder.suite}`,
    );
  }
  if (Date.parse(challenge.challengeExpiresAt) <= now().getTime()) {
    throw new PolicyAccessError(
      "engine-response-invalid",
      "policy engine issued an already-expired challenge",
    );
  }

  const ttl = options.presentationTtlSeconds ?? DEFAULT_PRESENTATION_TTL_SECONDS;
  const eligibleSubjectDid = options.eligibleSubjectDid ?? holder.did;
  const holderBinding = options.holderBinding ?? EPHEMERAL_HOLDER_BINDING;
  if (
    holderBinding === EPHEMERAL_HOLDER_BINDING &&
    eligibleSubjectDid !== holder.did
  ) {
    throw new PolicyAccessError(
      "holder-mismatch",
      "an ephemeral-holder binding requires the eligible subject to be the holder key",
    );
  }
  const unsigned = {
    schema: GRANT_PRESENTATION_V0_SCHEMA,
    policyId: descriptor.policyId,
    eligibleSubjectDid,
    holderDid: holder.did,
    holderBinding,
    requestedCapabilities: capabilities,
    requestedCapabilitiesHash: requestedCapabilitiesHashHex(capabilities),
    audience: descriptor.policyEngine.audience,
    nonce: challenge.nonce,
    expiresAt: rfc3339(new Date(now().getTime() + ttl * 1000)),
    evidence: options.evidence,
  } as const;
  const presentation = {
    ...unsigned,
    holderSignature: {
      suite: holder.suite,
      signerDid: holder.did,
      value: holder.signGrantPresentation(unsigned),
    },
  };

  const resolveResponse = await transport.request({
    method: "POST",
    url: `${trimTrailingSlash(descriptor.policyEngine.endpoint)}/policy/v0/resolve`,
    body: { presentation },
  });
  if (resolveResponse.status !== 200) {
    throw engineDenial(resolveResponse.status, resolveResponse.body);
  }

  const delegation = parsePolicyAccessDelegation(
    asRecord(resolveResponse.body)?.delegation,
    descriptor,
    holder,
    capabilities,
  );
  return {
    delegation,
    delegationCid: deriveDelegationCid(delegation.encoded!),
    nonce: challenge.nonce,
    challengeId: challenge.challengeId,
    expiresAt: delegation.expiresAt,
  };
}

/**
 * Validate a Policy Engine delegation strictly from its signed compact-JWS
 * authority. Nothing here trusts the unsigned JSON envelope.
 */
export function parsePolicyAccessDelegation(
  input: unknown,
  descriptor: PolicyAccessDescriptor,
  holder: EphemeralHolderKey,
  capabilities: readonly PolicyCapability[],
): PortableDelegation {
  let parsed: PortableDelegation;
  try {
    parsed = parseNodeNativePortableDelegation(input);
  } catch (error) {
    throw new PolicyAccessError(
      "delegation-invalid",
      `policy engine returned an unusable delegation: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (parsed.policyId !== descriptor.policyId) {
    throw new PolicyAccessError(
      "delegation-invalid",
      "delegation policyId does not match the requested policy",
    );
  }
  if (parsed.holderDid !== holder.did) {
    throw new PolicyAccessError(
      "delegation-wrong-holder",
      "delegation is not bound to the ephemeral holder key that proved possession",
    );
  }
  if (parsed.issuerDid !== descriptor.policyEngine.grantIssuerDid) {
    throw new PolicyAccessError(
      "delegation-wrong-issuer",
      "delegation issuer is not the configured policy engine grant issuer",
    );
  }
  if (!parsed.terminal) {
    throw new PolicyAccessError(
      "delegation-not-terminal",
      "policy access requires a terminal (non-redelegatable) grant",
    );
  }
  if (parsed.maxTtlSeconds > MAX_DELEGATION_TTL_SECONDS) {
    throw new PolicyAccessError(
      "delegation-ttl-excessive",
      `delegation TTL ${parsed.maxTtlSeconds}s exceeds the ${MAX_DELEGATION_TTL_SECONDS}s ceiling`,
    );
  }
  const issuedAt = Date.parse(parsed.issuedAt);
  const expiresAt = Date.parse(parsed.expiresAt);
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > parsed.maxTtlSeconds * 1000
  ) {
    throw new PolicyAccessError(
      "delegation-ttl-excessive",
      "delegation validity window is outside its declared maxTtlSeconds",
    );
  }
  for (const granted of parsed.capabilities) {
    if (
      !capabilities.some((requested) =>
        policyCapabilityContains(requested, granted),
      )
    ) {
      throw new PolicyAccessError(
        "delegation-capability-wider",
        "delegation grants authority outside the exact requested capability set",
      );
    }
  }
  if (
    typeof parsed.encoded !== "string" ||
    parsed.encoded.split(".").length !== 3
  ) {
    throw new PolicyAccessError(
      "delegation-invalid",
      "delegation is not a compact-JWS UCAN",
    );
  }
  return parsed;
}

async function importDelegation(
  options: OpenPolicyAccessOptions,
  grant: PolicyAccessGrant,
): Promise<void> {
  const { descriptor, transport } = options;
  const response = await transport.request({
    method: "POST",
    url: `${trimTrailingSlash(descriptor.ownerNode.endpoint)}/delegate`,
    headers: { Authorization: grant.delegation.encoded! },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new PolicyAccessError(
      "delegation-import-failed",
      `owner node refused the delegation import (status ${response.status})`,
      { status: response.status },
    );
  }
  const receipt = asRecord(response.body);
  const activated = Array.isArray(receipt?.activated)
    ? (receipt.activated as unknown[])
    : undefined;
  const skipped = Array.isArray(receipt?.skipped)
    ? (receipt.skipped as unknown[])
    : [];
  if (
    activated === undefined ||
    !activated.includes(descriptor.ownerNode.spaceId) ||
    skipped.includes(descriptor.ownerNode.spaceId)
  ) {
    throw new PolicyAccessError(
      "delegation-import-failed",
      "owner node did not activate the delegation for the target space",
    );
  }
}

function headersRecord(headers: ServiceHeaders): Record<string, string> {
  return Array.isArray(headers) ? Object.fromEntries(headers) : { ...headers };
}

function decodeBody(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return textEncoder.encode(body);
  const record = asRecord(body);
  const value = record?.value ?? record?.data;
  if (typeof value === "string") return textEncoder.encode(value);
  if (value instanceof Uint8Array) return value;
  throw new PolicyAccessError(
    "node-response-invalid",
    "owner node returned a body the policy-access reader cannot interpret",
  );
}

/**
 * Complete the recipient side of a policy-gated read: present, delegate, and
 * hold a short-lived session that can read the exact ciphertext.
 *
 * The returned session performs *no* decryption — the caller decrypts locally
 * with key material it already holds.
 */
export async function openPolicyAccess(
  options: OpenPolicyAccessOptions,
): Promise<PolicyAccessSession> {
  const grant = await requestPolicyAccessGrant(options);
  await importDelegation(options, grant);
  const now = options.now ?? (() => new Date());
  const { descriptor, holder, transport } = options;

  const session: ServiceSession = {
    delegationHeader: { Authorization: grant.delegation.encoded! },
    delegationCid: grant.delegationCid,
    spaceId: descriptor.ownerNode.spaceId,
    verificationMethod: holder.keyId,
    jwk: holder.jwk,
  };

  return {
    grant,
    holderDid: holder.did,
    expiresAt: grant.expiresAt,
    isActive: () => Date.parse(grant.expiresAt) > now().getTime(),
    async readEncrypted(path: string): Promise<PolicyAccessReadResult> {
      if (Date.parse(grant.expiresAt) <= now().getTime()) {
        throw new PolicyAccessError(
          "session-expired",
          "policy access grant expired before the read",
        );
      }
      const granted = grant.delegation.capabilities.find(
        (capability) =>
          capability.service === "tinycloud.kv" &&
          capability.path === path &&
          capability.actions.includes("tinycloud.kv/get"),
      );
      if (granted === undefined) {
        throw new PolicyAccessError(
          "read-not-contained",
          `the grant does not cover an exact kv/get on "${path}"`,
        );
      }
      const headers = headersRecord(
        options.invoke(session, "kv", path, "tinycloud.kv/get"),
      );
      const response = await transport.request({
        method: "POST",
        url: `${trimTrailingSlash(descriptor.ownerNode.endpoint)}/invoke`,
        headers,
      });
      if (response.status === 401 || response.status === 403) {
        throw new PolicyAccessError(
          "node-denied",
          "owner node denied the invocation",
          { status: response.status },
        );
      }
      if (response.status < 200 || response.status >= 300) {
        throw new PolicyAccessError(
          "node-response-invalid",
          `owner node returned status ${response.status}`,
          { status: response.status },
        );
      }
      return {
        ciphertext: decodeBody(response.body),
        resource: { space: granted.space, path: granted.path },
      };
    },
  };
}
