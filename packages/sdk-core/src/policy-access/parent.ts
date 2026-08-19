import { PolicyAccessError } from "./errors";
import type { PolicyAccessTransport } from "./transport";

export const POLICY_PARENT_REGISTRATION_PATH = "/policy/v0/parent-delegations" as const;
export const GENERIC_DELEGATION_IMPORT_PATH = "/delegate" as const;

export interface PolicyParentCapability {
  readonly service: string;
  readonly space: string;
  readonly path: string;
  readonly actions: readonly string[];
  readonly caveats?: Readonly<Record<string, unknown>>;
}

export interface RegisterPolicyParentDelegationInput {
  readonly policyEngineEndpoint: string;
  readonly nodeEndpoint: string;
  readonly ownerDid: string;
  /** Owner-signed, proofless compact UCAN addressed to the grant issuer. */
  readonly authorization: string;
  readonly delegationCid: string;
  readonly nativeResource: string;
  readonly policyCapability: PolicyParentCapability;
  readonly transport: PolicyAccessTransport;
}

function origin(value: string): string {
  const parsed = new URL(value);
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if ((parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new PolicyAccessError("access-descriptor-invalid", "policy parent endpoints must be canonical HTTPS origins");
  }
  return parsed.origin;
}

/**
 * Persist an owner-signed generic root in the normal Node delegation graph,
 * then register the same bytes as the Policy Engine's issuance parent.
 * Neither operation gives Node any policy-evaluation role.
 */
export async function registerPolicyParentDelegation(
  input: RegisterPolicyParentDelegationInput,
): Promise<void> {
  const engineOrigin = origin(input.policyEngineEndpoint);
  const nodeOrigin = origin(input.nodeEndpoint);
  const imported = await input.transport.request({
    method: "POST",
    url: `${nodeOrigin}${GENERIC_DELEGATION_IMPORT_PATH}`,
    headers: { authorization: `Bearer ${input.authorization.replace(/^Bearer\s+/i, "")}` },
  });
  const importedBody = imported.body as { cid?: unknown } | undefined;
  if (imported.status !== 200 || importedBody?.cid !== input.delegationCid) {
    throw new PolicyAccessError("node-response-invalid", "node refused the generic policy issuance parent", { status: imported.status });
  }
  const registration = await input.transport.request({
    method: "POST",
    url: `${engineOrigin}${POLICY_PARENT_REGISTRATION_PATH}`,
    body: {
      ownerDid: input.ownerDid,
      authorization: input.authorization,
      expectedCid: input.delegationCid,
      capabilityBounds: [{
        policyCapability: input.policyCapability,
        nativeResource: input.nativeResource,
      }],
    },
  });
  const registrationBody = registration.body as { registeredDelegationId?: unknown } | undefined;
  if (registration.status !== 200 || registrationBody?.registeredDelegationId !== input.delegationCid) {
    throw new PolicyAccessError("engine-denied", "policy engine refused the policy issuance parent", { status: registration.status });
  }
}
