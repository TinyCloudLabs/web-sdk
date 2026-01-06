/**
 * TinyCloudNode - High-level API for Node.js users.
 *
 * Each user has their own TinyCloudNode instance with their own key.
 * This class provides a simplified interface for:
 * - Signing in and managing sessions
 * - Key-value storage operations on own namespace
 * - Creating and using delegations
 *
 * @example
 * ```typescript
 * const alice = new TinyCloudNode({
 *   privateKey: process.env.ALICE_PRIVATE_KEY,
 *   host: "https://node.tinycloud.xyz",
 *   prefix: "myapp",
 * });
 *
 * await alice.signIn();
 * await alice.kv.put("greeting", "Hello, world!");
 *
 * // Delegate access to Bob
 * const delegation = await alice.createDelegation({
 *   path: "shared/",
 *   actions: ["tinycloud.kv/get", "tinycloud.kv/put"],
 *   delegateDID: bob.did,
 * });
 *
 * // Bob uses the delegation
 * const access = await bob.useDelegation(delegation);
 * const data = await access.kv.get("shared/data");
 * ```
 */

import {
  TinyCloud,
  TinyCloudSession,
  activateSessionWithHost,
  KVService,
  IKVService,
  ServiceSession,
} from "@tinycloudlabs/sdk-core";
import { NodeUserAuthorization } from "./authorization/NodeUserAuthorization";
import { PrivateKeySigner } from "./signers/PrivateKeySigner";
import { FileSessionStorage } from "./storage/FileSessionStorage";
import { MemorySessionStorage } from "./storage/MemorySessionStorage";
import {
  TCWSessionManager,
  prepareSession,
  completeSessionSetup,
  ensureEip55,
  invoke,
  makeNamespaceId,
  initPanicHook,
} from "@tinycloudlabs/node-sdk-wasm";
import { PortableDelegation } from "./delegation";
import { DelegatedAccess } from "./DelegatedAccess";

/**
 * Configuration for TinyCloudNode.
 */
export interface TinyCloudNodeConfig {
  /** Hex-encoded private key (with or without 0x prefix) */
  privateKey: string;
  /** TinyCloud server URL (e.g., "https://node.tinycloud.xyz") */
  host: string;
  /** Namespace prefix for this user's namespace */
  prefix: string;
  /** Domain for SIWE messages (default: derived from host) */
  domain?: string;
  /** Session expiration time in milliseconds (default: 1 hour) */
  sessionExpirationMs?: number;
}

/**
 * High-level TinyCloud API for Node.js environments.
 *
 * Each user creates their own TinyCloudNode instance with their private key.
 * The instance manages the user's session and provides access to their namespace.
 */
export class TinyCloudNode {
  /** Flag to ensure WASM panic hook is only initialized once */
  private static wasmInitialized = false;

  private config: TinyCloudNodeConfig;
  private signer: PrivateKeySigner;
  private auth: NodeUserAuthorization;
  private tc: TinyCloud;
  private _address?: string;
  private _chainId: number = 1;
  private sessionManager?: TCWSessionManager;
  private _kv?: IKVService;

  /**
   * Create a new TinyCloudNode instance.
   *
   * @param config - Configuration options
   */
  constructor(config: TinyCloudNodeConfig) {
    // Initialize WASM panic hook once
    if (!TinyCloudNode.wasmInitialized) {
      initPanicHook();
      TinyCloudNode.wasmInitialized = true;
    }

    this.config = config;
    this.signer = new PrivateKeySigner(config.privateKey, this._chainId);

    // Derive domain from host if not provided
    const domain = config.domain ?? new URL(config.host).hostname;

    this.auth = new NodeUserAuthorization({
      signer: this.signer,
      signStrategy: { type: "auto-sign" },
      sessionStorage: new MemorySessionStorage(),
      domain,
      namespacePrefix: config.prefix,
      sessionExpirationMs: config.sessionExpirationMs ?? 60 * 60 * 1000,
      tinycloudHosts: [config.host],
    });

    this.tc = new TinyCloud(this.auth);
  }

  /**
   * Get the DID for this user's session key.
   * Available after signIn().
   */
  get did(): string {
    if (!this.sessionManager) {
      throw new Error("Not signed in. Call signIn() first.");
    }
    const session = this.auth.tinyCloudSession;
    if (!session) {
      throw new Error("No active session");
    }
    return session.verificationMethod;
  }

  /**
   * Get the Ethereum address for this user.
   */
  get address(): string | undefined {
    return this._address;
  }

  /**
   * Get the PKH DID for this user (based on Ethereum address).
   * Use this for user-to-user delegations.
   * Format: did:pkh:eip155:{chainId}:{address}
   * Available after signIn().
   */
  get pkhDid(): string {
    if (!this._address) {
      throw new Error("Not signed in. Call signIn() first.");
    }
    return `did:pkh:eip155:${this._chainId}:${this._address}`;
  }

  /**
   * Get the namespace ID for this user.
   * Available after signIn().
   */
  get namespaceId(): string | undefined {
    return this.auth.tinyCloudSession?.namespaceId;
  }

  /**
   * Get the current TinyCloud session.
   * Available after signIn().
   */
  get session(): TinyCloudSession | undefined {
    return this.auth.tinyCloudSession;
  }

  /**
   * Sign in and create a new session.
   * This creates the user's namespace if it doesn't exist.
   */
  async signIn(): Promise<void> {
    this._address = await this.signer.getAddress();
    this._chainId = await this.signer.getChainId();

    // Create session manager for tracking
    this.sessionManager = new TCWSessionManager();

    // Reset KV service so it gets recreated with new session
    this._kv = undefined;

    await this.tc.signIn();
  }

  /**
   * Key-value storage operations on this user's namespace.
   */
  get kv(): IKVService {
    if (!this._kv) {
      const session = this.auth.tinyCloudSession;
      if (!session) {
        throw new Error("Not signed in. Call signIn() first.");
      }
      this._kv = new KVService({
        host: this.config.host,
        session: session as ServiceSession,
        invoke,
      });
    }
    return this._kv;
  }

  /**
   * Create a delegation from this user to another user.
   *
   * The delegation grants the recipient access to a specific path and actions
   * within this user's namespace.
   *
   * @param params - Delegation parameters
   * @returns A portable delegation that can be sent to the recipient
   */
  async createDelegation(params: {
    /** Path within the namespace to delegate access to */
    path: string;
    /** Actions to allow (e.g., ["tinycloud.kv/get", "tinycloud.kv/put"]) */
    actions: string[];
    /** DID of the recipient (from their TinyCloudNode.did) */
    delegateDID: string;
    /** Whether to prevent the recipient from creating sub-delegations (default: false) */
    disableSubDelegation?: boolean;
    /** Expiration time in milliseconds from now (default: 1 hour) */
    expiryMs?: number;
  }): Promise<PortableDelegation> {
    const session = this.auth.tinyCloudSession;
    if (!session) {
      throw new Error("Not signed in. Call signIn() first.");
    }

    // Build abilities for the delegation
    const abilities: Record<string, Record<string, string[]>> = {
      kv: {
        [params.path]: params.actions,
      },
    };

    const now = new Date();
    const expiryMs = params.expiryMs ?? 60 * 60 * 1000; // Default 1 hour
    const expirationTime = new Date(now.getTime() + expiryMs);

    // Prepare the delegation session with:
    // - delegateUri: target the recipient's DID directly (for user-to-user delegation)
    // - parents: reference our session CID for chain validation
    const prepared = prepareSession({
      abilities,
      address: ensureEip55(session.address),
      chainId: session.chainId,
      domain: new URL(this.config.host).hostname,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      namespaceId: session.namespaceId,
      delegateUri: params.delegateDID,
      parents: [session.delegationCid],
    });

    // Sign the SIWE message with this user's signer
    const signature = await this.signer.signMessage(prepared.siwe);

    // Complete the session setup
    const delegationSession = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Activate the delegation with the server
    const activateResult = await activateSessionWithHost(
      this.config.host,
      delegationSession.delegationHeader
    );

    if (!activateResult.success) {
      throw new Error(`Failed to activate delegation: ${activateResult.error}`);
    }

    // Return the portable delegation
    return {
      delegationCid: delegationSession.delegationCid,
      delegationHeader: delegationSession.delegationHeader,
      namespaceId: session.namespaceId,
      path: params.path,
      actions: params.actions,
      disableSubDelegation: params.disableSubDelegation ?? false,
      expiry: expirationTime,
      delegateDID: params.delegateDID,
      ownerAddress: session.address,
      chainId: session.chainId,
    };
  }

  /**
   * Use a delegation received from another user.
   *
   * This creates a new session key for this user that chains from the
   * received delegation, allowing operations on the delegator's namespace.
   *
   * @param delegation - The portable delegation received from another user
   * @returns A DelegatedAccess instance for performing operations
   */
  async useDelegation(delegation: PortableDelegation): Promise<DelegatedAccess> {
    const mySession = this.auth.tinyCloudSession;
    if (!mySession) {
      throw new Error("Not signed in. Call signIn() first.");
    }

    // Use our existing session key - the delegation targets our DID from signIn
    // We must use the same key that the delegation was created for
    const jwk = mySession.jwk;

    // Build abilities from the delegation
    const abilities: Record<string, Record<string, string[]>> = {
      kv: {
        [delegation.path]: delegation.actions,
      },
    };

    const now = new Date();
    // Use delegation expiry or 1 hour, whichever is sooner
    const maxExpiry = new Date(now.getTime() + 60 * 60 * 1000);
    const expirationTime = delegation.expiry < maxExpiry ? delegation.expiry : maxExpiry;

    // Prepare the session with:
    // - THIS user's address (we are the invoker)
    // - The delegation owner's namespace (where we're accessing data)
    // - Our existing session key (must match the DID the delegation targets)
    // - Parent reference to the received delegation
    const prepared = prepareSession({
      abilities,
      address: ensureEip55(mySession.address),
      chainId: mySession.chainId,
      domain: new URL(this.config.host).hostname,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      namespaceId: delegation.namespaceId,
      jwk,
      parents: [delegation.delegationCid],
    });

    // Sign with THIS user's signer
    const signature = await this.signer.signMessage(prepared.siwe);

    // Complete the session setup
    const invokerSession = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Activate with server
    const activateResult = await activateSessionWithHost(
      this.config.host,
      invokerSession.delegationHeader
    );

    if (!activateResult.success) {
      throw new Error(`Failed to activate delegated session: ${activateResult.error}`);
    }

    // Create TinyCloudSession for the delegated access
    const session: TinyCloudSession = {
      address: mySession.address,
      chainId: mySession.chainId,
      sessionKey: mySession.sessionKey,
      namespaceId: delegation.namespaceId,
      delegationCid: invokerSession.delegationCid,
      delegationHeader: invokerSession.delegationHeader,
      verificationMethod: mySession.verificationMethod,
      jwk,
      siwe: prepared.siwe,
      signature,
    };

    return new DelegatedAccess(session, delegation, this.config.host);
  }

  /**
   * Create a sub-delegation from a received delegation.
   *
   * This allows further delegating access that was received from another user,
   * if the original delegation allows sub-delegation.
   *
   * @param parentDelegation - The delegation received from another user
   * @param params - Sub-delegation parameters (must be within parent's scope)
   * @returns A portable delegation for the sub-delegate
   */
  async createSubDelegation(
    parentDelegation: PortableDelegation,
    params: {
      /** Path within the delegated path to sub-delegate */
      path: string;
      /** Actions to allow (must be subset of parent's actions) */
      actions: string[];
      /** DID of the recipient */
      delegateDID: string;
      /** Whether to prevent the recipient from creating further sub-delegations */
      disableSubDelegation?: boolean;
      /** Expiration time in milliseconds from now (must be before parent's expiry) */
      expiryMs?: number;
    }
  ): Promise<PortableDelegation> {
    if (!this._address) {
      throw new Error("Not signed in. Call signIn() first.");
    }

    // Validate sub-delegation is allowed
    if (parentDelegation.disableSubDelegation) {
      throw new Error("Parent delegation does not allow sub-delegation");
    }

    // Validate path is within parent's path
    if (!params.path.startsWith(parentDelegation.path)) {
      throw new Error(
        `Sub-delegation path "${params.path}" must be within parent path "${parentDelegation.path}"`
      );
    }

    // Validate actions are subset of parent's actions
    const parentActions = new Set(parentDelegation.actions);
    for (const action of params.actions) {
      if (!parentActions.has(action)) {
        throw new Error(
          `Sub-delegation action "${action}" is not in parent's actions: ${parentDelegation.actions.join(", ")}`
        );
      }
    }

    // Calculate expiry - cap at parent's expiry
    const now = new Date();
    const expiryMs = params.expiryMs ?? 60 * 60 * 1000;
    const requestedExpiry = new Date(now.getTime() + expiryMs);
    // Sub-delegation cannot outlive parent, so cap at parent's expiry
    const actualExpiry =
      requestedExpiry > parentDelegation.expiry ? parentDelegation.expiry : requestedExpiry;

    // Build abilities for the sub-delegation
    const abilities: Record<string, Record<string, string[]>> = {
      kv: {
        [params.path]: params.actions,
      },
    };

    // Prepare the sub-delegation session
    // Uses THIS user's address (who received the delegation and is now sub-delegating)
    // Targets the recipient's PKH DID (delegateUri)
    // References the parent delegation as the chain
    const prepared = prepareSession({
      abilities,
      address: ensureEip55(this._address),
      chainId: this._chainId,
      domain: new URL(this.config.host).hostname,
      issuedAt: now.toISOString(),
      expirationTime: actualExpiry.toISOString(),
      namespaceId: parentDelegation.namespaceId,
      delegateUri: params.delegateDID,
      parents: [parentDelegation.delegationCid],
    });

    // Sign with THIS user's signer
    const signature = await this.signer.signMessage(prepared.siwe);

    // Complete the session setup
    const subDelegationSession = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Activate the sub-delegation with the server
    const activateResult = await activateSessionWithHost(
      this.config.host,
      subDelegationSession.delegationHeader
    );

    if (!activateResult.success) {
      throw new Error(`Failed to activate sub-delegation: ${activateResult.error}`);
    }

    // Return the portable sub-delegation
    return {
      delegationCid: subDelegationSession.delegationCid,
      delegationHeader: subDelegationSession.delegationHeader,
      namespaceId: parentDelegation.namespaceId,
      path: params.path,
      actions: params.actions,
      disableSubDelegation: params.disableSubDelegation ?? false,
      expiry: actualExpiry,
      delegateDID: params.delegateDID,
      ownerAddress: parentDelegation.ownerAddress,
      chainId: parentDelegation.chainId,
    };
  }
}
