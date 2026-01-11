/**
 * A portable delegation that can be transported between users.
 * This is a serializable credential that grants access to a space.
 */
export interface PortableDelegation {
  /** The CID of this delegation */
  delegationCid: string;

  /** The authorization header for this delegation */
  delegationHeader: { Authorization: string };

  /** The space this grants access to (the owner's space) */
  spaceId: string;

  /** The path within the space this grants access to */
  path: string;

  /** The actions this delegation authorizes */
  actions: string[];

  /** Whether the recipient is prevented from creating sub-delegations (default: false allows sub-delegation) */
  disableSubDelegation: boolean;

  /** When this delegation expires */
  expiry: Date;

  /** The DID of who this delegation is for (the recipient) */
  delegateDID: string;

  /** The address of the space owner */
  ownerAddress: string;

  /** The chain ID */
  chainId: number;
}

/**
 * Serialize a PortableDelegation for transport (e.g., over network).
 */
export function serializeDelegation(delegation: PortableDelegation): string {
  return JSON.stringify({
    ...delegation,
    expiry: delegation.expiry.toISOString(),
  });
}

/**
 * Deserialize a PortableDelegation from transport.
 */
export function deserializeDelegation(data: string): PortableDelegation {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    expiry: new Date(parsed.expiry),
  };
}
