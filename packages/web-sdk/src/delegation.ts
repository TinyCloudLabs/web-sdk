/**
 * Delegation types and utilities for web-sdk.
 *
 * These types are compatible with node-sdk's delegation system,
 * allowing delegations to be exchanged between platforms.
 */

import {
  Delegation,
  TinyCloudSession,
  KVService,
  IKVService,
  ServiceSession,
  ServiceContext,
  JWK,
} from "@tinycloudlabs/sdk-core";
import { invoke } from "./modules/Storage/tinycloud/module";

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

/**
 * Provides access to a space via a received delegation.
 *
 * This is returned by TinyCloudWeb.useDelegation() and provides
 * KV operations on the delegated space.
 *
 * @example
 * ```typescript
 * // Receive a delegation from another user
 * const delegation = deserializeDelegation(receivedData);
 *
 * // Use the delegation
 * const access = await tcw.useDelegation(delegation);
 *
 * // Perform KV operations on the delegated space
 * const data = await access.kv.get("shared/document.json");
 * await access.kv.put("shared/notes.txt", "Hello!");
 * ```
 */
export class DelegatedAccess {
  private session: TinyCloudSession;
  private _delegation: PortableDelegation;
  private host: string;
  private _serviceContext: ServiceContext;
  private _kv: KVService;

  constructor(
    session: TinyCloudSession,
    delegation: PortableDelegation,
    host: string
  ) {
    this.session = session;
    this._delegation = delegation;
    this.host = host;

    // Create service context
    this._serviceContext = new ServiceContext({
      invoke: invoke as any,
      fetch: globalThis.fetch.bind(globalThis),
      hosts: [host],
    });

    // Create and initialize KV service with path prefix from delegation
    // Strip trailing slash to avoid double-slash in paths
    const prefix = this._delegation.path.replace(/\/$/, "");
    this._kv = new KVService({ prefix });
    this._kv.initialize(this._serviceContext);
    this._serviceContext.registerService("kv", this._kv);

    // Set session on context
    const serviceSession: ServiceSession = {
      delegationHeader: session.delegationHeader,
      delegationCid: session.delegationCid,
      spaceId: session.spaceId,
      verificationMethod: session.verificationMethod,
      jwk: session.jwk,
    };
    this._serviceContext.setSession(serviceSession);
  }

  /**
   * Get the delegation this access was created from.
   */
  get delegation(): PortableDelegation {
    return this._delegation;
  }

  /**
   * The space ID this access is for.
   */
  get spaceId(): string {
    return this._delegation.spaceId;
  }

  /**
   * The path this access is scoped to.
   */
  get path(): string {
    return this._delegation.path;
  }

  /**
   * KV operations on the delegated space.
   */
  get kv(): IKVService {
    return this._kv;
  }
}
