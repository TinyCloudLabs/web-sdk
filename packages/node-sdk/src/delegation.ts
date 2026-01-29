import { Delegation } from "@tinycloudlabs/sdk-core";

/**
 * A portable delegation that can be transported between users.
 * Extends the base Delegation type with fields required for transport.
 *
 * @remarks
 * PortableDelegation adds transport fields to Delegation:
 * - `delegationHeader`: Structured authorization header for API calls
 * - `ownerAddress`: Space owner's address for session creation
 * - `chainId`: Chain ID for session creation
 * - `host`: Optional server URL
 */
export interface PortableDelegation extends Omit<Delegation, "isRevoked"> {
  /** The authorization header for this delegation (structured format) */
  delegationHeader: { Authorization: string };

  /** The address of the space owner */
  ownerAddress: string;

  /** The chain ID */
  chainId: number;

  /** TinyCloud server URL where this delegation was created */
  host?: string;

  /** Whether the recipient is prevented from creating sub-delegations */
  disableSubDelegation?: boolean;

  /** @deprecated Use `cid` instead */
  delegationCid?: string;
}

/**
 * Serialize a PortableDelegation for transport (e.g., over network).
 */
export function serializeDelegation(delegation: PortableDelegation): string {
  return JSON.stringify({
    ...delegation,
    expiry: delegation.expiry.toISOString(),
    // Ensure both cid and delegationCid are present for backwards compat
    delegationCid: delegation.cid,
  });
}

/**
 * Deserialize a PortableDelegation from transport.
 * Handles both new format (cid) and legacy format (delegationCid).
 */
export function deserializeDelegation(data: string): PortableDelegation {
  const parsed = JSON.parse(data);
  // Support both cid (new) and delegationCid (legacy)
  const cid = parsed.cid || parsed.delegationCid;
  return {
    ...parsed,
    cid,
    delegationCid: cid, // Keep for backwards compat
    expiry: new Date(parsed.expiry),
  };
}
