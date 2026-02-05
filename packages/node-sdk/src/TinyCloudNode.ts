/**
 * TinyCloudNode - High-level API for Node.js users.
 *
 * Each user has their own TinyCloudNode instance with their own key.
 * This class provides a simplified interface for:
 * - Signing in and managing sessions
 * - Key-value storage operations on own space
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
  ServiceContext,
  // v2 services
  DelegationManager,
  SpaceService,
  ISpaceService,
  CapabilityKeyRegistry,
  ICapabilityKeyRegistry,
  SharingService,
  ISharingService,
  // v2 types
  Delegation,
  CreateDelegationParams,
  KeyInfo,
  JWK,
  DelegationResult,
  CreateDelegationWasmParams,
  CreateDelegationWasmResult,
} from "@tinycloud/sdk-core";
import { NodeUserAuthorization } from "./authorization/NodeUserAuthorization";
import { PrivateKeySigner } from "./signers/PrivateKeySigner";
import { FileSessionStorage } from "./storage/FileSessionStorage";
import { MemorySessionStorage } from "./storage/MemorySessionStorage";
import {
  TCWSessionManager as SessionManager,
  prepareSession,
  completeSessionSetup,
  ensureEip55,
  invoke,
  makeSpaceId,
  initPanicHook,
  createDelegation,
} from "@tinycloud/node-sdk-wasm";
import { PortableDelegation } from "./delegation";
import { DelegatedAccess } from "./DelegatedAccess";
import { WasmKeyProvider } from "./keys/WasmKeyProvider";

/** Default TinyCloud host */
const DEFAULT_HOST = "https://node.tinycloud.xyz";

/**
 * Configuration for TinyCloudNode.
 * All fields are optional - TinyCloudNode can work with zero configuration.
 */
export interface TinyCloudNodeConfig {
  /** Hex-encoded private key (with or without 0x prefix). Optional - only needed for wallet mode and signIn() */
  privateKey?: string;
  /** TinyCloud server URL (default: "https://node.tinycloud.xyz") */
  host?: string;
  /** Space prefix for this user's space. Optional - only needed for signIn() */
  prefix?: string;
  /** Domain for SIWE messages (default: derived from host) */
  domain?: string;
  /** Session expiration time in milliseconds (default: 1 hour) */
  sessionExpirationMs?: number;
  /** Whether to automatically create space if it doesn't exist (default: false) */
  autoCreateSpace?: boolean;
}

/**
 * High-level TinyCloud API for Node.js environments.
 *
 * Each user creates their own TinyCloudNode instance with their private key.
 * The instance manages the user's session and provides access to their space.
 */
export class TinyCloudNode {
  /** Flag to ensure WASM panic hook is only initialized once */
  private static wasmInitialized = false;

  private config: TinyCloudNodeConfig;
  private signer: PrivateKeySigner | null = null;
  private auth: NodeUserAuthorization | null = null;
  private tc: TinyCloud | null = null;
  private _address?: string;
  private _chainId: number = 1;
  private sessionManager: SessionManager;
  private _serviceContext?: ServiceContext;
  private _kv?: KVService;

  /** Session key ID - always available */
  private sessionKeyId: string;
  /** Session key JWK as object - always available */
  private sessionKeyJwk: object;

  // v2 services (initialized in constructor)
  private _capabilityRegistry: CapabilityKeyRegistry;
  private _keyProvider: WasmKeyProvider;
  private _sharingService: SharingService;
  // These are initialized after signIn()
  private _delegationManager?: DelegationManager;
  private _spaceService?: SpaceService;

  /**
   * Create a new TinyCloudNode instance.
   *
   * All configuration is optional. Without a privateKey, the instance operates
   * in "session-only" mode where it can receive delegations but cannot create
   * its own space via signIn().
   *
   * @param config - Configuration options (all optional)
   *
   * @example
   * ```typescript
   * // Session-only mode - can receive delegations
   * const bob = new TinyCloudNode();
   * console.log(bob.did); // did:key:z6Mk... - available immediately
   *
   * // Wallet mode - can create own space
   * const alice = new TinyCloudNode({
   *   privateKey: process.env.ALICE_PRIVATE_KEY,
   *   prefix: "myapp",
   * });
   * await alice.signIn();
   * ```
   */
  constructor(config: TinyCloudNodeConfig = {}) {
    // Initialize WASM panic hook once
    if (!TinyCloudNode.wasmInitialized) {
      initPanicHook();
      TinyCloudNode.wasmInitialized = true;
    }

    // Store config with default host
    this.config = {
      ...config,
      host: config.host ?? DEFAULT_HOST,
    };

    // Always create session manager and session key immediately
    this.sessionManager = new SessionManager();

    // Try to use "default" key, create if it doesn't exist
    const defaultKeyId = "default";
    let jwkStr = this.sessionManager.jwk(defaultKeyId);
    if (jwkStr) {
      // Key already exists, reuse it
      this.sessionKeyId = defaultKeyId;
    } else {
      // Create new key
      this.sessionKeyId = this.sessionManager.createSessionKey(defaultKeyId);
      jwkStr = this.sessionManager.jwk(this.sessionKeyId);
    }

    if (!jwkStr) {
      throw new Error("Failed to get session key JWK");
    }
    this.sessionKeyJwk = JSON.parse(jwkStr);

    // Initialize capability registry for all users (needed for tracking received delegations)
    this._capabilityRegistry = new CapabilityKeyRegistry();

    // Initialize KeyProvider for SharingService
    this._keyProvider = new WasmKeyProvider({
      sessionManager: this.sessionManager,
    });

    // Initialize SharingService for receive-only access (no session required)
    // This allows session-only users to receive sharing links without signIn()
    // Full capabilities (generate) are added after signIn()
    this._sharingService = new SharingService({
      hosts: [this.config.host!],
      // session: undefined - not needed for receive()
      invoke,
      fetch: globalThis.fetch.bind(globalThis),
      keyProvider: this._keyProvider,
      registry: this._capabilityRegistry,
      // delegationManager: undefined - not needed for receive()
      createKVService: (config) => {
        // Use pathPrefix as the KV service prefix for sharing links
        // Strip trailing slash to match DelegatedAccess behavior
        const prefix = config.pathPrefix?.replace(/\/$/, '');
        const kvService = new KVService({ prefix });
        // Create a new service context for the KV service
        const kvContext = new ServiceContext({
          invoke: config.invoke,
          fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
          hosts: config.hosts,
        });
        kvContext.setSession(config.session);
        kvService.initialize(kvContext);
        return kvService;
      },
    });

    // Only set up wallet/auth if privateKey is provided
    if (config.privateKey) {
      this.signer = new PrivateKeySigner(config.privateKey, this._chainId);

      // Derive domain from host if not provided
      const host = this.config.host!;
      const domain = config.domain ?? new URL(host).hostname;

      this.auth = new NodeUserAuthorization({
        signer: this.signer,
        signStrategy: { type: "auto-sign" },
        sessionStorage: new MemorySessionStorage(),
        domain,
        spacePrefix: config.prefix,
        sessionExpirationMs: config.sessionExpirationMs ?? 60 * 60 * 1000,
        tinycloudHosts: [host],
        autoCreateSpace: config.autoCreateSpace,
      });

      this.tc = new TinyCloud(this.auth);
    }
  }

  /**
   * Get the primary identity DID for this user.
   * - If wallet connected and signed in: returns PKH DID (did:pkh:eip155:{chainId}:{address})
   * - If session-only mode: returns session key DID (did:key:z6Mk...)
   *
   * Use this for delegations - it always returns the appropriate identity.
   */
  get did(): string {
    // If wallet is connected and signed in, return PKH (persistent identity)
    if (this._address) {
      return `did:pkh:eip155:${this._chainId}:${this._address}`;
    }
    // Session-only mode: return session key DID (ephemeral identity)
    return this.sessionManager.getDID(this.sessionKeyId);
  }

  /**
   * Get the session key DID. Always available.
   * Format: did:key:z6Mk...#z6Mk...
   *
   * Use this when you specifically need the session key, not the user identity.
   */
  get sessionDid(): string {
    return this.sessionManager.getDID(this.sessionKeyId);
  }

  /**
   * Get the Ethereum address for this user.
   */
  get address(): string | undefined {
    return this._address;
  }

  /**
   * Check if this instance is in session-only mode (no wallet).
   * In session-only mode, the instance can receive delegations but cannot
   * create its own space via signIn().
   */
  get isSessionOnly(): boolean {
    return this.signer === null;
  }

  /**
   * Get the space ID for this user.
   * Available after signIn().
   */
  get spaceId(): string | undefined {
    return this.auth?.tinyCloudSession?.spaceId;
  }

  /**
   * Get the current TinyCloud session.
   * Available after signIn().
   */
  get session(): TinyCloudSession | undefined {
    return this.auth?.tinyCloudSession;
  }

  /**
   * Sign in and create a new session.
   * This creates the user's space if it doesn't exist.
   * Requires wallet mode (privateKey in config).
   */
  async signIn(): Promise<void> {
    if (!this.signer || !this.tc) {
      throw new Error(
        "Cannot signIn() in session-only mode. Provide a privateKey in config to create your own space."
      );
    }

    this._address = await this.signer.getAddress();
    this._chainId = await this.signer.getChainId();

    // Reset KV service so it gets recreated with new session
    this._kv = undefined;
    this._serviceContext = undefined;

    await this.tc.signIn();

    // Initialize service context with session
    this.initializeServices();
  }

  /**
   * Connect a wallet to upgrade from session-only mode to wallet mode.
   *
   * This allows a user who started in session-only mode to later connect
   * a wallet and gain the ability to create their own space.
   *
   * Note: This does NOT automatically sign in. Call signIn() after connecting
   * the wallet to create your space.
   *
   * @param privateKey - The Ethereum private key (hex string, no 0x prefix)
   * @param options - Optional configuration
   * @param options.prefix - Space name prefix (defaults to "default")
   *
   * @example
   * ```typescript
   * // Start in session-only mode
   * const node = new TinyCloudNode({ host: "https://node.tinycloud.xyz" });
   * console.log(node.did); // did:key:z6Mk... (session key)
   *
   * // Later, connect a wallet
   * node.connectWallet(privateKey);
   * await node.signIn();
   * console.log(node.did); // did:pkh:eip155:1:0x... (PKH)
   * ```
   */
  connectWallet(privateKey: string, options?: { prefix?: string }): void {
    if (this.signer) {
      throw new Error("Wallet already connected. Cannot connect another wallet.");
    }

    const prefix = options?.prefix ?? "default";
    const host = this.config.host!;
    const domain = new URL(host).hostname;

    // Create signer from private key
    this.signer = new PrivateKeySigner(privateKey);

    // Create authorization handler
    this.auth = new NodeUserAuthorization({
      signer: this.signer,
      signStrategy: { type: "auto-sign" },
      sessionStorage: new MemorySessionStorage(),
      domain,
      spacePrefix: prefix,
      sessionExpirationMs: this.config.sessionExpirationMs ?? 60 * 60 * 1000,
      tinycloudHosts: [host],
      autoCreateSpace: this.config.autoCreateSpace,
    });

    // Create TinyCloud instance
    this.tc = new TinyCloud(this.auth);

    // Update config with prefix
    this.config.prefix = prefix;
  }

  /**
   * Initialize the service context and KV service after sign-in.
   * @internal
   */
  private initializeServices(): void {
    const session = this.auth?.tinyCloudSession;
    if (!session) {
      return;
    }

    // Create service context
    this._serviceContext = new ServiceContext({
      invoke,
      fetch: globalThis.fetch.bind(globalThis),
      hosts: [this.config.host!],
    });

    // Create and register KV service
    this._kv = new KVService({});
    this._kv.initialize(this._serviceContext);
    this._serviceContext.registerService('kv', this._kv);

    // Set session on context
    const serviceSession: ServiceSession = {
      delegationHeader: session.delegationHeader,
      delegationCid: session.delegationCid,
      spaceId: session.spaceId,
      verificationMethod: session.verificationMethod,
      jwk: session.jwk,
    };
    this._serviceContext.setSession(serviceSession);

    // Initialize v2 services
    this.initializeV2Services(serviceSession);
  }

  /**
   * Initialize the v2 delegation system services.
   * @internal
   */
  private initializeV2Services(serviceSession: ServiceSession): void {
    // Initialize CapabilityKeyRegistry
    this._capabilityRegistry = new CapabilityKeyRegistry();

    const tcSession = this.auth?.tinyCloudSession;
    // Register the session key with its capabilities
    if (tcSession && this._address) {
      const sessionKey: KeyInfo = {
        id: tcSession.sessionKey,
        did: tcSession.verificationMethod,
        type: "session",
        // Cast jwk from generic object to JWK - we know it has the required structure
        jwk: tcSession.jwk as JWK,
        priority: 0, // Session keys have highest priority
      };

      // Create root delegation for the session
      const rootDelegation: Delegation = {
        cid: tcSession.delegationCid,
        delegateDID: tcSession.verificationMethod,
        spaceId: tcSession.spaceId,
        path: "", // Root access
        actions: [
          "tinycloud.kv/put",
          "tinycloud.kv/get",
          "tinycloud.kv/del",
          "tinycloud.kv/list",
          "tinycloud.kv/metadata",
        ],
        expiry: this.getSessionExpiry(),
        isRevoked: false,
        allowSubDelegation: true,
      };

      this._capabilityRegistry.registerKey(sessionKey, [rootDelegation]);
    }

    // Initialize DelegationManager
    this._delegationManager = new DelegationManager({
      hosts: [this.config.host!],
      session: serviceSession,
      invoke,
      fetch: globalThis.fetch.bind(globalThis),
    });

    // Initialize SpaceService
    this._spaceService = new SpaceService({
      hosts: [this.config.host!],
      session: serviceSession,
      invoke,
      fetch: globalThis.fetch.bind(globalThis),
      capabilityRegistry: this._capabilityRegistry,
      userDid: this.did,
      createKVService: (spaceId: string) => {
        // Create a new KV service scoped to the specified space
        const kvService = new KVService({});
        if (this._serviceContext) {
          kvService.initialize(this._serviceContext);
        }
        return kvService;
      },
      // Enable space.delegations.create() via SIWE-based delegation
      createDelegation: async (params) => {
        try {
          // Use the existing createDelegation method which calls /delegate with SIWE
          const portableDelegation = await this.createDelegation({
            delegateDID: params.delegateDID,
            path: params.path,
            actions: params.actions,
            disableSubDelegation: params.disableSubDelegation,
            expiryMs: params.expiry
              ? params.expiry.getTime() - Date.now()
              : undefined,
          });

          // Convert PortableDelegation to Delegation type for Space API
          const delegation: Delegation = {
            cid: portableDelegation.cid,
            delegateDID: portableDelegation.delegateDID,
            delegatorDID: this.did,
            spaceId: portableDelegation.spaceId,
            path: portableDelegation.path,
            actions: portableDelegation.actions,
            expiry: portableDelegation.expiry,
            isRevoked: false,
            allowSubDelegation: !portableDelegation.disableSubDelegation,
            createdAt: new Date(),
            authHeader: portableDelegation.delegationHeader.Authorization,
          };

          return { ok: true, data: delegation };
        } catch (error) {
          return {
            ok: false,
            error: {
              code: "CREATION_FAILED",
              message: error instanceof Error ? error.message : String(error),
              service: "delegation",
            },
          };
        }
      },
    });

    // Update SharingService with full capabilities (session + createDelegation)
    // SharingService was initialized in constructor for receive-only access
    this._sharingService.updateConfig({
      session: serviceSession,
      delegationManager: this._delegationManager,
      sessionExpiry: this.getSessionExpiry(),
      // WASM-based delegation creation (preferred - no server roundtrip)
      createDelegationWasm: (params) => this.createDelegationWrapper(params),
    });

    // Wire up SharingService to SpaceService for space.sharing.generate()
    this._spaceService.updateConfig({
      sharingService: this._sharingService,
    });
  }

  /**
   * Get the session expiry time.
   * @internal
   */
  private getSessionExpiry(): Date {
    // Default to 1 hour from now if not explicitly set
    const expirationMs = this.config.sessionExpirationMs ?? 60 * 60 * 1000;
    return new Date(Date.now() + expirationMs);
  }

  /**
   * Wrapper for the WASM createDelegation function.
   * Adapts the WASM interface to what SharingService expects.
   * @internal
   */
  private createDelegationWrapper(params: CreateDelegationWasmParams): CreateDelegationWasmResult {
    // Convert ServiceSession to the format WASM expects
    const wasmSession = {
      delegationHeader: params.session.delegationHeader,
      delegationCid: params.session.delegationCid,
      jwk: params.session.jwk,
      spaceId: params.session.spaceId,
      verificationMethod: params.session.verificationMethod,
    };

    const result = createDelegation(
      wasmSession,
      params.delegateDID,
      params.spaceId,
      params.path,
      params.actions,
      params.expirationSecs,
      params.notBeforeSecs
    );

    return {
      delegation: result.delegation,
      cid: result.cid,
      delegateDID: result.delegateDid,
      path: result.path,
      actions: result.actions,
      expiry: new Date(result.expiry * 1000),
    };
  }

  /**
   * Track a received delegation in the capability registry.
   * @internal
   */
  private trackReceivedDelegation(delegation: PortableDelegation, jwk: JWK): void {
    if (!this._capabilityRegistry) {
      return;
    }

    const keyInfo: KeyInfo = {
      id: `received:${delegation.cid}`,
      did: this.sessionDid,
      type: "ingested",
      jwk,
      priority: 2,
    };

    // Convert PortableDelegation to Delegation type
    const delegationRecord: Delegation = {
      cid: delegation.cid,
      delegateDID: delegation.delegateDID,
      spaceId: delegation.spaceId,
      path: delegation.path,
      actions: delegation.actions,
      expiry: delegation.expiry,
      isRevoked: false,
      allowSubDelegation: !delegation.disableSubDelegation,
    };

    this._capabilityRegistry.ingestKey(keyInfo, delegationRecord);
  }

  /**
   * Key-value storage operations on this user's space.
   */
  get kv(): IKVService {
    if (!this._kv) {
      throw new Error("Not signed in. Call signIn() first.");
    }
    return this._kv;
  }

  // ===========================================================================
  // v2 Service Accessors
  // ===========================================================================

  /**
   * Get the CapabilityKeyRegistry for managing keys and their capabilities.
   *
   * The registry tracks keys (session, main, ingested) and their associated
   * delegations, enabling automatic key selection for operations.
   *
   * @example
   * ```typescript
   * const registry = alice.capabilityRegistry;
   *
   * // Get the best key for an operation
   * const key = registry.getKeyForCapability(
   *   "tinycloud://my-space/kv/data",
   *   "tinycloud.kv/get"
   * );
   *
   * // List all capabilities
   * const capabilities = registry.getAllCapabilities();
   * ```
   */
  get capabilityRegistry(): ICapabilityKeyRegistry {
    if (!this._capabilityRegistry) {
      throw new Error("CapabilityKeyRegistry not initialized.");
    }
    return this._capabilityRegistry;
  }

  /**
   * Access received delegations (recipient view).
   *
   * Use this to see what delegations have been received via useDelegation().
   *
   * @example
   * ```typescript
   * // List all received delegations
   * const received = bob.delegations.list();
   * console.log("I have access to:", received.length, "spaces");
   *
   * // Get a specific delegation by CID
   * const delegation = bob.delegations.get(cid);
   * ```
   */
  get delegations(): {
    /** List all received delegations */
    list: () => Delegation[];
    /** Get a delegation by CID */
    get: (cid: string) => Delegation | undefined;
  } {
    const registry = this._capabilityRegistry;
    if (!registry) {
      return {
        list: () => [],
        get: () => undefined,
      };
    }

    return {
      list: () => registry.getAllCapabilities().map((entry) => entry.delegation),
      get: (cid: string) => {
        const capabilities = registry.getAllCapabilities();
        const entry = capabilities.find((e) => e.delegation.cid === cid);
        return entry?.delegation;
      },
    };
  }

  /**
   * Get the DelegationManager for delegation CRUD operations.
   *
   * This is the v2 delegation service providing a cleaner API than
   * the legacy createDelegation/useDelegation methods.
   *
   * @example
   * ```typescript
   * const delegations = alice.delegationManager;
   *
   * // Create a delegation
   * const result = await delegations.create({
   *   delegateDID: bob.did,
   *   path: "shared/",
   *   actions: ["tinycloud.kv/get", "tinycloud.kv/put"],
   *   expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
   * });
   *
   * // List delegations
   * const listResult = await delegations.list();
   *
   * // Revoke a delegation
   * await delegations.revoke(delegationCid);
   * ```
   */
  get delegationManager(): DelegationManager {
    if (!this._delegationManager) {
      throw new Error("Not signed in. Call signIn() first.");
    }
    return this._delegationManager;
  }

  /**
   * Get the SpaceService for managing spaces.
   *
   * The SpaceService provides access to owned and delegated spaces,
   * including space creation, listing, and scoped operations.
   *
   * @example
   * ```typescript
   * const spaces = alice.spaces;
   *
   * // List all accessible spaces
   * const result = await spaces.list();
   *
   * // Create a new space
   * const createResult = await spaces.create('photos');
   *
   * // Get a space object for operations
   * const mySpace = spaces.get('default');
   * await mySpace.kv.put('key', 'value');
   *
   * // Check if a space exists
   * const exists = await spaces.exists('photos');
   * ```
   */
  get spaces(): ISpaceService {
    if (!this._spaceService) {
      throw new Error("Not signed in. Call signIn() first.");
    }
    return this._spaceService;
  }

  /**
   * Alias for `spaces` - get the SpaceService.
   * @see spaces
   */
  get spaceService(): ISpaceService {
    return this.spaces;
  }

  /**
   * Get the SharingService for creating and receiving v2 sharing links.
   *
   * The SharingService creates sharing links with embedded private keys,
   * allowing recipients to exercise delegations without prior session setup.
   *
   * @example
   * ```typescript
   * const sharing = alice.sharing;
   *
   * // Generate a sharing link
   * const result = await sharing.generate({
   *   path: "/kv/documents/report.pdf",
   *   actions: ["tinycloud.kv/get"],
   *   expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
   * });
   *
   * if (result.ok) {
   *   console.log("Share URL:", result.data.url);
   *   // Send the URL to the recipient
   * }
   *
   * // Receive a sharing link
   * const receiveResult = await sharing.receive(shareUrl);
   * if (receiveResult.ok) {
   *   // Use the pre-configured KV service
   *   const data = await receiveResult.data.kv.get("report.pdf");
   * }
   * ```
   */
  get sharing(): ISharingService {
    // SharingService is initialized in constructor for receive-only access
    // Full capabilities (generate) are added after signIn()
    return this._sharingService;
  }

  /**
   * Alias for `sharing` - get the SharingService.
   * @see sharing
   */
  get sharingService(): ISharingService {
    return this.sharing;
  }

  // ===========================================================================
  // v2 Delegation Convenience Methods
  // ===========================================================================

  /**
   * Create a delegation using the v2 DelegationManager.
   *
   * This is a convenience method that wraps DelegationManager.create().
   * For more control, use `this.delegationManager` directly.
   *
   * @param params - Delegation parameters
   * @returns Result containing the created Delegation
   *
   * @example
   * ```typescript
   * const result = await alice.delegate({
   *   delegateDID: bob.did,
   *   path: "shared/",
   *   actions: ["tinycloud.kv/get", "tinycloud.kv/put"],
   *   expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
   * });
   *
   * if (result.ok) {
   *   console.log("Delegation created:", result.data.cid);
   * }
   * ```
   */
  async delegate(params: CreateDelegationParams): Promise<DelegationResult<Delegation>> {
    return this.delegationManager.create(params);
  }

  /**
   * Revoke a delegation using the v2 DelegationManager.
   *
   * @param cid - The CID of the delegation to revoke
   * @returns Result indicating success or failure
   */
  async revokeDelegation(cid: string): Promise<DelegationResult<void>> {
    return this.delegationManager.revoke(cid);
  }

  /**
   * List all delegations for the current session's space.
   *
   * @returns Result containing an array of Delegations
   */
  async listDelegations(): Promise<DelegationResult<Delegation[]>> {
    return this.delegationManager.list();
  }

  /**
   * Check if the current session has permission for a path and action.
   *
   * @param path - The resource path to check
   * @param action - The action to check (e.g., "tinycloud.kv/get")
   * @returns Result containing boolean permission status
   */
  async checkPermission(path: string, action: string): Promise<DelegationResult<boolean>> {
    return this.delegationManager.checkPermission(path, action);
  }

  /**
   * Create a delegation from this user to another user.
   *
   * The delegation grants the recipient access to a specific path and actions
   * within this user's space.
   *
   * @param params - Delegation parameters
   * @returns A portable delegation that can be sent to the recipient
   */
  async createDelegation(params: {
    /** Path within the space to delegate access to */
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
    if (!this.signer) {
      throw new Error("Cannot createDelegation() in session-only mode. Requires wallet mode.");
    }
    const session = this.auth?.tinyCloudSession;
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
      domain: new URL(this.config.host!).hostname,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      spaceId: session.spaceId,
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
      this.config.host!,
      delegationSession.delegationHeader
    );

    if (!activateResult.success) {
      throw new Error(`Failed to activate delegation: ${activateResult.error}`);
    }

    // Return the portable delegation
    return {
      cid: delegationSession.delegationCid,
      delegationHeader: delegationSession.delegationHeader,
      spaceId: session.spaceId,
      path: params.path,
      actions: params.actions,
      disableSubDelegation: params.disableSubDelegation ?? false,
      expiry: expirationTime,
      delegateDID: params.delegateDID,
      ownerAddress: session.address,
      chainId: session.chainId,
      host: this.config.host,
    };
  }

  /**
   * Use a delegation received from another user.
   *
   * This creates a new session key for this user that chains from the
   * received delegation, allowing operations on the delegator's space.
   *
   * Works in both modes:
   * - **Wallet mode**: Creates a SIWE sub-delegation from PKH to session key
   * - **Session-only mode**: Uses the delegation directly (must target session key DID)
   *
   * @param delegation - The PortableDelegation to use (from createDelegation or transport)
   * @returns A DelegatedAccess instance for performing operations
   */
  async useDelegation(delegation: PortableDelegation): Promise<DelegatedAccess> {
    const delegationHeader = delegation.delegationHeader;

    // Use the host from the delegation if provided, otherwise fall back to config
    const targetHost = delegation.host ?? this.config.host!;

    // Session-only mode: use the delegation directly
    // The delegation must target this user's session key DID
    if (this.isSessionOnly) {
      // Verify the delegation targets our session key DID
      const myDid = this.did; // In session-only mode, this is the session key DID
      if (delegation.delegateDID !== myDid) {
        throw new Error(
          `Delegation targets ${delegation.delegateDID} but this user's DID is ${myDid}. ` +
          `The delegation must target this user's DID.`
        );
      }

      // Create a session using the delegation directly
      // In session-only mode, we use the received delegation as-is
      const session: TinyCloudSession = {
        address: delegation.ownerAddress,
        chainId: delegation.chainId,
        sessionKey: JSON.stringify(this.sessionKeyJwk),
        spaceId: delegation.spaceId,
        delegationCid: delegation.cid,
        delegationHeader,
        verificationMethod: this.sessionDid,
        jwk: this.sessionKeyJwk as unknown as JWK,
        siwe: "", // Not used in session-only mode
        signature: "", // Not used in session-only mode
      };

      // Track received delegation in registry
      this.trackReceivedDelegation(delegation, this.sessionKeyJwk as unknown as JWK);

      return new DelegatedAccess(session, delegation, targetHost);
    }

    // Wallet mode: create a SIWE sub-delegation
    const mySession = this.auth?.tinyCloudSession;
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
    // - The delegation owner's space (where we're accessing data)
    // - Our existing session key (must match the DID the delegation targets)
    // - Parent reference to the received delegation
    const prepared = prepareSession({
      abilities,
      address: ensureEip55(mySession.address),
      chainId: mySession.chainId,
      domain: new URL(targetHost).hostname,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      spaceId: delegation.spaceId,
      jwk,
      parents: [delegation.cid],
    });

    // Sign with THIS user's signer
    const signature = await this.signer!.signMessage(prepared.siwe);

    // Complete the session setup
    const invokerSession = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Activate with server
    const activateResult = await activateSessionWithHost(
      targetHost,
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
      spaceId: delegation.spaceId,
      delegationCid: invokerSession.delegationCid,
      delegationHeader: invokerSession.delegationHeader,
      verificationMethod: mySession.verificationMethod,
      jwk,
      siwe: prepared.siwe,
      signature,
    };

    // Track received delegation in registry
    this.trackReceivedDelegation(delegation, jwk as unknown as JWK);

    return new DelegatedAccess(session, delegation, targetHost);
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
    if (!this.signer) {
      throw new Error("Cannot createSubDelegation() in session-only mode. Requires wallet mode.");
    }
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

    // Use parent's host or fall back to config
    const targetHost = parentDelegation.host ?? this.config.host!;

    // Prepare the sub-delegation session
    // Uses THIS user's address (who received the delegation and is now sub-delegating)
    // Targets the recipient's PKH DID (delegateUri)
    // References the parent delegation as the chain
    const prepared = prepareSession({
      abilities,
      address: ensureEip55(this._address),
      chainId: this._chainId,
      domain: new URL(targetHost).hostname,
      issuedAt: now.toISOString(),
      expirationTime: actualExpiry.toISOString(),
      spaceId: parentDelegation.spaceId,
      delegateUri: params.delegateDID,
      parents: [parentDelegation.cid],
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
      targetHost,
      subDelegationSession.delegationHeader
    );

    if (!activateResult.success) {
      throw new Error(`Failed to activate sub-delegation: ${activateResult.error}`);
    }

    // Return the portable sub-delegation
    return {
      cid: subDelegationSession.delegationCid,
      delegationHeader: subDelegationSession.delegationHeader,
      spaceId: parentDelegation.spaceId,
      path: params.path,
      actions: params.actions,
      disableSubDelegation: params.disableSubDelegation ?? false,
      expiry: actualExpiry,
      delegateDID: params.delegateDID,
      ownerAddress: parentDelegation.ownerAddress!,
      chainId: parentDelegation.chainId!,
      host: targetHost,
    };
  }
}
