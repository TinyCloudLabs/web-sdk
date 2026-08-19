import { PolicyAccessError } from "./errors";
import type { PolicyAccessTransport } from "./transport";

export const POLICY_PARENT_REGISTRATION_PATH = "/policy/v0/parent-delegations" as const;

export interface PolicyParentCapability {
  readonly service: string;
  readonly space: string;
  readonly path: string;
  readonly actions: readonly string[];
  readonly caveats?: Readonly<Record<string, unknown>>;
}

export interface RegisterPolicyParentDelegationInput {
  readonly policyEngineEndpoint: string;
  readonly ownerNodeEndpoint: string;
  readonly ownerNodeSpaceId: string;
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
 * Activate an owner-signed generic root on the ordinary Node `/delegate`
 * boundary, then register the same verified root as the Policy Engine's
 * issuance parent. No application route or bearer authority is involved.
 */
export async function registerPolicyParentDelegation(
  input: RegisterPolicyParentDelegationInput,
): Promise<void> {
  const nodeOrigin = origin(input.ownerNodeEndpoint);
  const engineOrigin = origin(input.policyEngineEndpoint);
  const activation = await input.transport.request({
    method: "POST",
    url: `${nodeOrigin}/delegate`,
    headers: { Authorization: input.authorization },
  });
  const activationBody = activation.body as { activated?: unknown; skipped?: unknown } | undefined;
  if (
    activation.status < 200 || activation.status >= 300 ||
    !Array.isArray(activationBody?.activated) ||
    !activationBody.activated.includes(input.ownerNodeSpaceId) ||
    (Array.isArray(activationBody.skipped) && activationBody.skipped.includes(input.ownerNodeSpaceId))
  ) {
    throw new PolicyAccessError("delegation-import-failed", "owner node refused the policy issuance parent", { status: activation.status });
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
