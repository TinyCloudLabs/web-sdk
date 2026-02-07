import {
  RPCProviders,
} from '@tinycloud/web-core';
import {
  WebUserAuthorization,
  WebUserAuthorizationConfig,
  WebSignStrategy,
  ModalSpaceCreationHandler,
  defaultWebSpaceCreationHandler,
} from '../authorization';
import {
  ClientConfig,
  ClientSession,
  Extension,
} from '@tinycloud/web-core/client';
import type { providers } from 'ethers';
import { SDKErrorHandler, ToastManager } from '../notifications';
import type { NotificationConfig } from '../notifications/types';
import {
  ServiceContext,
  KVService,
  IKVService,
  ServiceSession,
  ServiceError,
  // New delegation system services
  CapabilityKeyRegistry,
  ICapabilityKeyRegistry,
  DelegationManager,
  SpaceService,
  ISpaceService,
  ISpace,
  // v2 types for session key registration
  KeyInfo,
  Delegation,
  JWK,
  TinyCloudSession,
  // v2 Sharing types
  Result,
  DelegationError,
  EncodedShareData,
  // v2 SharingService
  SharingService,
  ISharingService,
  CreateDelegationParams,
  // WASM delegation types
  CreateDelegationWasmParams,
  CreateDelegationWasmResult,
  // Strategy types
  ISpaceCreationHandler,
  // Space delegation types
  SpaceDelegationParams,
  activateSessionWithHost,
} from '@tinycloud/sdk-core';
import { WasmKeyProvider } from './keys';
import { WasmInitializer } from './WasmInitializer';
import { invoke, prepareSession, completeSessionSetup } from './Storage/tinycloud/module';
import { tinycloud } from '@tinycloud/web-sdk-wasm';
import { PortableDelegation, DelegatedAccess } from '../delegation';

declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * Configuration for TinyCloudWeb.
 *
 * Extends ClientConfig with notification options and the unified auth module.
 *
 * ## Auth Module Features
 *
 * - **SignStrategy pattern**: Control how sign requests are handled
 * - **Session-only mode**: Receive delegations without a wallet
 * - **`did` vs `sessionDid` model**: Clear identity distinction
 * - **`connectWallet()` upgrade pattern**: Upgrade from session-only to full auth
 *
 * @example
 * ```typescript
 * // Standard wallet popup flow
 * const tcw = new TinyCloudWeb({
 *   providers: { web3: { driver: window.ethereum } },
 *   signStrategy: { type: 'wallet-popup' },
 *   spaceCreationHandler: new ModalSpaceCreationHandler()
 * });
 *
 * // Session-only mode (no wallet required)
 * const tcw = new TinyCloudWeb();
 * console.log(tcw.sessionDid); // did:key:z6Mk...
 * ```
 */
export interface Config extends ClientConfig {
  /** Notification configuration for error popups and toasts */
  notifications?: NotificationConfig;

  /** Optional prefix for KV service keys */
  kvPrefix?: string;

  /**
   * Prefix for space names when creating spaces.
   * @example 'myapp' results in spaces like 'myapp-default'
   */
  spacePrefix?: string;

  /**
   * TinyCloud server hosts.
   * @default ['https://node.tinycloud.xyz']
   */
  tinycloudHosts?: string[];

  /**
   * Whether to auto-create space on sign-in if it doesn't exist.
   * @default true
   */
  autoCreateSpace?: boolean;

  /**
   * Sign strategy for handling sign requests.
   *
   * Determines how SIWE signing is handled:
   * - `'wallet-popup'` (default): Show browser wallet popup
   * - `{ type: 'auto-sign' }`: Automatically sign (requires external signer setup)
   * - `{ type: 'callback', handler: fn }`: Custom callback for sign requests
   * - `{ type: 'event-emitter', emitter: ee }`: Emit events for external handling
   *
   * @example
   * ```typescript
   * // Default: wallet popup
   * signStrategy: 'wallet-popup'
   *
   * // Custom callback for approval UI
   * signStrategy: {
   *   type: 'callback',
   *   handler: async (req) => {
   *     const approved = await showCustomApprovalDialog(req.message);
   *     return { approved };
   *   }
   * }
   * ```
   */
  signStrategy?: WebSignStrategy;

  /**
   * Handler for space creation confirmation.
   *
   * Controls how space creation is confirmed:
   * - `ModalSpaceCreationHandler` (default): Shows a modal dialog
   * - `{ confirmSpaceCreation: async () => true }`: Auto-approve
   * - Custom implementation of `ISpaceCreationHandler`
   *
   * @example
   * ```typescript
   * // Default: modal confirmation
   * spaceCreationHandler: new ModalSpaceCreationHandler()
   *
   * // Auto-approve (no UI)
   * spaceCreationHandler: { confirmSpaceCreation: async () => true }
   *
   * // Custom handler
   * spaceCreationHandler: {
   *   confirmSpaceCreation: async (context) => {
   *     return await showCustomDialog(`Create space: ${context.spaceId}?`);
   *   }
   * }
   * ```
   */
  spaceCreationHandler?: ISpaceCreationHandler;
}

const DEFAULT_CONFIG: ClientConfig = {
  providers: {
    web3: {
      driver: globalThis.ethereum,
    },
  },
};

// =============================================================================
// Share Link Utilities (for receiving v2 share links without auth)
// =============================================================================

const TC1_PREFIX = 'tc1:';

/**
 * Base64 URL decode.
 */
function base64UrlDecode(encoded: string): string {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(base64)));
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
  throw new Error('No base64 decoding available');
}

/**
 * Decode a v2 share link (tc1:...).
 */
function decodeShareLink(link: string): EncodedShareData {
  let encoded = link;
  // Handle full URL format
  if (link.includes('/share/')) {
    const parts = link.split('/share/');
    encoded = parts[parts.length - 1];
  }
  // Handle query parameter format
  if (link.includes('?share=')) {
    const url = new URL(link);
    encoded = url.searchParams.get('share') ?? encoded;
  }
  if (!encoded.startsWith(TC1_PREFIX)) {
    throw new Error(`Invalid share link format. Expected prefix '${TC1_PREFIX}'`);
  }
  const base64Data = encoded.slice(TC1_PREFIX.length);
  const jsonString = base64UrlDecode(base64Data);
  const data = JSON.parse(jsonString) as EncodedShareData;
  if (data.version !== 1) {
    throw new Error(`Unsupported share link version: ${data.version}`);
  }
  return data;
}

/**
 * Result of receiving a share link.
 */
export interface ShareReceiveResult<T = unknown> {
  /** The retrieved data */
  data: T;
  /** The delegation that authorized access */
  delegation: Delegation;
  /** The path the share grants access to */
  path: string;
  /** The space ID */
  spaceId: string;
}

/** TinyCloud Web SDK
 *
 * An SDK for building user-controlled web apps.
 */
export class TinyCloudWeb {
  /** The Ethereum provider */
  public provider: providers.Web3Provider;

  /** Supported RPC Providers */
  public static RPCProviders = RPCProviders;

  /**
   * Receive and retrieve data from a v2 share link.
   *
   * This static method allows receiving shared data without being signed in.
   * The share link contains an embedded private key and delegation that
   * grants access to the shared resource.
   *
   * @param link - The share link (tc1:... format or full URL)
   * @param key - Optional specific key to retrieve within the shared path
   * @returns Result containing the data or an error
   *
   * @example
   * ```typescript
   * // Receive shared data using just the link
   * const result = await TinyCloudWeb.receiveShare('tc1:...');
   * if (result.ok) {
   *   console.log('Data:', result.data.data);
   *   console.log('Path:', result.data.path);
   * } else {
   *   console.error('Error:', result.error.message);
   * }
   *
   * // Or from a full URL
   * const result = await TinyCloudWeb.receiveShare(
   *   'https://share.example.com/share/tc1:...'
   * );
   * ```
   */
  public static async receiveShare<T = unknown>(
    link: string,
    key?: string
  ): Promise<Result<ShareReceiveResult<T>, DelegationError>> {
    // Ensure WASM is initialized before using invoke
    await WasmInitializer.ensureInitialized();

    try {
      // Decode the share link
      const shareData = decodeShareLink(link);

      // Validate the embedded key has private component
      if (!shareData.key || !shareData.key.d) {
        return {
          ok: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Share link does not contain a valid private key',
            service: 'delegation',
          },
        };
      }

      // Check delegation expiry
      const expiry = new Date(shareData.delegation.expiry);
      if (expiry < new Date()) {
        return {
          ok: false,
          error: {
            code: 'AUTH_EXPIRED',
            message: 'Share link has expired',
            service: 'delegation',
          },
        };
      }

      // Check if revoked
      if (shareData.delegation.isRevoked) {
        return {
          ok: false,
          error: {
            code: 'REVOKED',
            message: 'Share link has been revoked',
            service: 'delegation',
          },
        };
      }

      // Create a minimal session using the embedded key
      // Use the authHeader from the delegation (UCAN JWT) for authorization
      // Strip "Bearer " prefix if present - WASM expects just the JWT token
      let authToken = shareData.delegation.authHeader ?? shareData.delegation.cid;
      if (authToken.startsWith('Bearer ')) {
        authToken = authToken.slice(7);
      }
      const session: ServiceSession = {
        delegationHeader: { Authorization: authToken },
        delegationCid: shareData.delegation.cid,
        spaceId: shareData.spaceId,
        verificationMethod: shareData.keyDid,
        jwk: shareData.key,
      };

      // Register the delegation with the server first
      // The server needs to know about this delegation before we can make invocations
      // This is idempotent - returns 200 whether newly created or already exists
      // NOTE: Server expects raw JWT token, not "Bearer " prefix
      const delegateResponse = await globalThis.fetch(`${shareData.host}/delegate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
      });

      if (!delegateResponse.ok) {
        const errorText = await delegateResponse.text();
        return {
          ok: false as const,
          error: {
            code: 'DELEGATION_FAILED',
            message: `Failed to register delegation: ${delegateResponse.status} - ${errorText}`,
            service: 'delegation' as const,
          },
        };
      }

      // Create context and KV service for fetching
      const context = new ServiceContext({
        invoke: invoke as any,
        fetch: globalThis.fetch.bind(globalThis),
        hosts: [shareData.host],
      });
      context.setSession(session);

      const kvService = new KVService({ prefix: '' });
      kvService.initialize(context);

      // Determine the key to fetch
      const fetchKey = key ?? shareData.path;

      // Fetch the data
      const kvResult = await kvService.get<T>(fetchKey);
      if (kvResult.ok) {
        return {
          ok: true as const,
          data: {
            data: kvResult.data.data,
            delegation: shareData.delegation,
            path: shareData.path,
            spaceId: shareData.spaceId,
          },
        };
      }
      // kvResult.ok is false here, so error is available
      const errorResult = kvResult as { ok: false; error: { message: string; cause?: Error } };
      return {
        ok: false as const,
        error: {
          code: 'DATA_FETCH_FAILED',
          message: `Failed to fetch shared data: ${errorResult.error.message}`,
          service: 'delegation' as const,
          cause: errorResult.error.cause,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'DECODE_FAILED',
          message: `Failed to process share link: ${err instanceof Error ? err.message : String(err)}`,
          service: 'delegation',
          cause: err instanceof Error ? err : undefined,
        },
      };
    }
  }

  /** UserAuthorization Module
   *
   * Handles the capabilities that a user can provide a app, specifically
   * authentication and authorization. This resource handles all key and
   * signing capabilities including:
   * - ethereum provider, wallet connection, SIWE message creation and signing
   * - session key management
   * - creates, manages, and handles session data
   * - manages/provides capabilities
   */
  public userAuthorization: WebUserAuthorization;

  /** Error Handler for Notifications */
  private errorHandler: SDKErrorHandler;

  /** Service Context for sdk-services */
  private _serviceContext?: ServiceContext;

  /** KV Service instance */
  private _kvService?: KVService;

  /** Capability Key Registry for automatic key selection */
  private _capabilityRegistry?: CapabilityKeyRegistry;

  /** Delegation Manager for CRUD operations on delegations */
  private _delegationManager?: DelegationManager;

  /** Space Service for managing spaces */
  private _spaceService?: SpaceService;

  /** KeyProvider for SharingService */
  private _keyProvider?: WasmKeyProvider;

  /** SharingService for generating/receiving share links */
  private _sharingService?: SharingService;

  constructor(private config: Config = DEFAULT_CONFIG) {
    // Initialize user authorization
    this.userAuthorization = this.createWebUserAuthorization(config);

    // Initialize error handling system
    const notificationConfig = {
      popups: config.notifications?.popups ?? true,
      throwErrors: config.notifications?.throwErrors ?? false
    };

    this.errorHandler = SDKErrorHandler.getInstance(notificationConfig);

    if (notificationConfig.popups) {
      // Initialize toast manager with configuration
      ToastManager.getInstance({
        position: config.notifications?.position,
        duration: config.notifications?.duration,
        maxVisible: config.notifications?.maxVisible
      });

      this.errorHandler.setupErrorHandling();
    }
  }

  /**
   * Create a WebUserAuthorization instance from the config.
   * Maps Config options to WebUserAuthorizationConfig.
   * @private
   */
  private createWebUserAuthorization(config: Config): WebUserAuthorization {
    const webAuthConfig: WebUserAuthorizationConfig = {
      // Provider from config
      provider: config.providers?.web3?.driver,

      // Strategy options (or defaults)
      signStrategy: config.signStrategy,
      spaceCreationHandler: config.spaceCreationHandler ?? new ModalSpaceCreationHandler(),
      autoCreateSpace: config.autoCreateSpace,

      // Map siweConfig properties
      domain: config.siweConfig?.domain,
      statement: config.siweConfig?.statement,

      // Space configuration
      spacePrefix: config.spacePrefix,
      tinycloudHosts: config.tinycloudHosts,
    };

    return new WebUserAuthorization(webAuthConfig);
  }

  /**
   * Get the KV service.
   *
   * Returns the new sdk-services KVService with Result pattern.
   * Must be signed in for the service to be available.
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * const result = await tcw.kv.get('key');
   * if (result.ok) {
   *   console.log(result.data.data);
   * } else {
   *   console.error(result.error.code, result.error.message);
   * }
   * ```
   */
  public get kv(): IKVService {
    if (!this._kvService) {
      throw new Error(
        'KV service is not available. Make sure you are signed in first.'
      );
    }
    return this._kvService;
  }

  /**
   * Get the KV prefix configured for this instance.
   */
  public get kvPrefix(): string {
    return this.config.kvPrefix || '';
  }

  /**
   * Get the capability key registry for automatic key selection.
   * This registry tracks keys and their associated delegations,
   * enabling automatic selection of the best key for operations.
   *
   * Must be signed in for the registry to be available.
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * // Get the best key for an operation
   * const key = tcw.capabilityRegistry.getKeyForCapability(
   *   'tinycloud://my-space/kv/data',
   *   'tinycloud.kv/get'
   * );
   *
   * // List all capabilities
   * const capabilities = tcw.capabilityRegistry.getAllCapabilities();
   * ```
   */
  public get capabilityRegistry(): ICapabilityKeyRegistry {
    if (!this._capabilityRegistry) {
      throw new Error(
        'Capability registry is not available. Make sure you are signed in first.'
      );
    }
    return this._capabilityRegistry;
  }

  /**
   * Get the delegation manager for CRUD operations on delegations.
   * Handles creating, revoking, listing, and querying delegations.
   *
   * Must be signed in for the manager to be available.
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * // Create a delegation
   * const result = await tcw.delegations.create({
   *   delegateDID: 'did:pkh:eip155:1:0x...',
   *   path: 'shared/',
   *   actions: ['tinycloud.kv/get', 'tinycloud.kv/list'],
   *   expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
   * });
   *
   * // List all delegations
   * const listResult = await tcw.delegations.list();
   *
   * // Revoke a delegation
   * await tcw.delegations.revoke('bafy...');
   * ```
   */
  public get delegations(): DelegationManager {
    if (!this._delegationManager) {
      throw new Error(
        'Delegation manager is not available. Make sure you are signed in first.'
      );
    }
    return this._delegationManager;
  }

  /**
   * Get the space service for managing spaces (owned and delegated).
   * Provides listing, creation, and access to space-scoped operations.
   *
   * Must be signed in for the service to be available.
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * // List all accessible spaces
   * const result = await tcw.spaces.list();
   * if (result.ok) {
   *   for (const space of result.data) {
   *     console.log(`${space.name} (${space.type})`);
   *   }
   * }
   *
   * // Create a new space
   * const createResult = await tcw.spaces.create('photos');
   *
   * // Get a space object for operations
   * const space = tcw.spaces.get('photos');
   * await space.kv.put('album/vacation', { photos: [...] });
   * ```
   */
  public get spaces(): ISpaceService {
    if (!this._spaceService) {
      throw new Error(
        'Space service is not available. Make sure you are signed in first.'
      );
    }
    return this._spaceService;
  }

  /**
   * Get a specific space by name or URI.
   * Shorthand for `tcw.spaces.get(nameOrUri)`.
   *
   * Must be signed in for the service to be available.
   *
   * @param nameOrUri - Short name or full space URI
   * @returns Space object with scoped operations
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * // Get an owned space by short name
   * const photos = tcw.space('photos');
   * await photos.kv.put('vacation/photo1.jpg', imageData);
   *
   * // Get a delegated space by full URI
   * const shared = tcw.space('tinycloud:pkh:eip155:1:0x...:shared');
   * const data = await shared.kv.get('document.json');
   * ```
   */
  public space(nameOrUri: string): ISpace {
    return this.spaces.get(nameOrUri);
  }

  /**
   * Get the sharing service for generating and managing share links.
   * Provides v2 sharing links with embedded private keys.
   *
   * Must be signed in for the service to be available.
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * // Generate a sharing link for a key
   * const result = await tcw.sharing.generate({
   *   path: 'shared/document.json',
   *   actions: ['tinycloud.kv/get'],
   *   expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
   * });
   * if (result.ok) {
   *   console.log('Share link:', result.data.link);
   * }
   *
   * // Receive a share (static method, no auth needed)
   * const shareResult = await TinyCloudWeb.receiveShare('tc1:...');
   * ```
   */
  public get sharing(): ISharingService {
    if (!this._sharingService) {
      throw new Error(
        'Sharing service is not available. Make sure you are signed in first.'
      );
    }
    return this._sharingService;
  }

  /**
   * Initialize the sdk-services KVService and other services.
   * Called internally after sign-in when the session is established.
   *
   * @internal
   */
  private initializeKVService(session: ClientSession): void {
    // Get hosts from userAuthorization or config
    const hosts = this.userAuthorization.getTinycloudHosts();

    // Get prefix from config
    const prefix = this.config.kvPrefix || '';

    // Create service context
    this._serviceContext = new ServiceContext({
      invoke: invoke as any,
      fetch: globalThis.fetch.bind(globalThis),
      hosts,
    });

    // Create and register KV service
    this._kvService = new KVService({ prefix });
    this._kvService.initialize(this._serviceContext);
    this._serviceContext.registerService('kv', this._kvService);

    // Convert TinyCloud session to ServiceSession and set on context
    const serviceSession = this.toServiceSession();
    if (serviceSession) {
      this._serviceContext.setSession(serviceSession);
    }

    // Initialize the new delegation system services
    this.initializeDelegationServices(hosts, serviceSession);
  }

  /**
   * Initialize the delegation system services.
   * Called internally after sign-in when the session is established.
   *
   * @param hosts - TinyCloud host URLs
   * @param serviceSession - The service session
   * @internal
   */
  private initializeDelegationServices(
    hosts: string[],
    serviceSession: ServiceSession | null
  ): void {
    if (!serviceSession) {
      return;
    }

    // Initialize CapabilityKeyRegistry
    this._capabilityRegistry = new CapabilityKeyRegistry();

    // Register the session key with its capabilities
    const tinycloudSession = this.userAuthorization.getTinycloudSession();
    const address = this.userAuthorization.address();
    const chainId = this.userAuthorization.chainId();

    if (tinycloudSession && address && chainId) {
      // Create KeyInfo for the session key
      const sessionKey: KeyInfo = {
        id: serviceSession.verificationMethod,
        did: serviceSession.verificationMethod,
        type: "session",
        jwk: serviceSession.jwk as JWK,
        priority: 0, // Session keys have highest priority
      };

      // Create root delegation for the session
      // The session is a self-delegation from the user's PKH to the session key
      const pkhDid = `did:pkh:eip155:${chainId}:${address}`;
      const rootDelegation: Delegation = {
        cid: serviceSession.delegationCid,
        delegateDID: serviceSession.verificationMethod,
        delegatorDID: pkhDid,
        spaceId: serviceSession.spaceId,
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
      hosts,
      session: serviceSession,
      invoke: invoke as any,
      fetch: globalThis.fetch.bind(globalThis),
    });

    // Initialize SpaceService
    // Derive PKH DID from address and chainId
    const userDid = address && chainId
      ? `did:pkh:eip155:${chainId}:${address}`
      : undefined;

    this._spaceService = new SpaceService({
      hosts,
      session: serviceSession,
      invoke: invoke as any,
      fetch: globalThis.fetch.bind(globalThis),
      capabilityRegistry: this._capabilityRegistry,
      // Create space-scoped KV service factory
      createKVService: (spaceId: string) => {
        const spaceScopedKV = new KVService({ prefix: '' });
        // Create a new context for the space-scoped session
        const spaceContext = new ServiceContext({
          invoke: invoke as any,
          fetch: globalThis.fetch.bind(globalThis),
          hosts,
        });
        spaceContext.setSession({
          ...serviceSession,
          spaceId,
        });
        spaceScopedKV.initialize(spaceContext);
        return spaceScopedKV;
      },
      // Get user's PKH DID
      userDid,
      // Create delegation using SIWE-based flow
      createDelegation: async (params: SpaceDelegationParams): Promise<Result<Delegation, ServiceError>> => {
        // Build session object from available data
        const sessionData = {
          address: address!,
          chainId: chainId!,
          delegationCid: serviceSession.delegationCid,
          spaceId: serviceSession.spaceId,
        };
        return this.createDelegationWithSIWE(params, sessionData, address!, chainId!, hosts);
      },
    });

    // Initialize KeyProvider for SharingService
    this._keyProvider = new WasmKeyProvider();

    // Initialize SharingService for generating/receiving share links
    this._sharingService = new SharingService({
      hosts,
      session: serviceSession,
      sessionExpiry: this.getSessionExpiry(),
      invoke: invoke as any,
      fetch: globalThis.fetch.bind(globalThis),
      keyProvider: this._keyProvider,
      registry: this._capabilityRegistry,
      delegationManager: this._delegationManager,
      pathPrefix: this.config.kvPrefix, // Pass kvPrefix so share paths match session capabilities
      createKVService: (config) => {
        // Strip trailing slash from pathPrefix like node-sdk does
        const prefix = config.pathPrefix?.replace(/\/$/, '') ?? '';
        const kvService = new KVService({ prefix });
        const kvContext = new ServiceContext({
          invoke: invoke as any,
          fetch: globalThis.fetch.bind(globalThis),
          hosts: config.hosts,
        });
        kvContext.setSession(config.session);
        kvService.initialize(kvContext);
        return kvService;
      },
      // WASM-based delegation creation (preferred - no server roundtrip)
      createDelegationWasm: (params) => this.createDelegationWrapper(params),
      // Custom createDelegation that includes authHeader for share links (fallback)
      createDelegation: async (params: CreateDelegationParams) => {
        // Use the WASM /delegate endpoint via the session's delegation mechanism
        // This creates a proper UCAN delegation with the authHeader
        const response = await this.createDelegationForSharing(params, serviceSession, hosts);
        return response;
      },
      // Callback to extend session when share duration exceeds current session
      // @deprecated - kept for backward compatibility, prefer onRootDelegationNeeded
      onSessionExtensionNeeded: async (requestedExpiry: Date) => {
        return this.extendSessionForSharing(requestedExpiry, hosts);
      },
      // Callback to create a DIRECT delegation from wallet to share key
      // This is the CORRECT solution for long-lived share links:
      // - Creates PKH -> share key delegation directly
      // - Not constrained by session expiry (no sub-delegation chain)
      // - Will trigger OpenKey popup to sign the delegation
      onRootDelegationNeeded: async (params) => {
        return this.createRootDelegationForSharing(params, hosts);
      },
    });
  }

  /**
   * Create a delegation for sharing using the WASM /delegate endpoint.
   * @internal
   */
  private async createDelegationForSharing(
    params: CreateDelegationParams,
    serviceSession: ServiceSession,
    hosts: string[]
  ): Promise<Result<Delegation, DelegationError>> {
    try {
      // Use the delegation manager to create the delegation
      const result = await this._delegationManager!.create(params);
      if (!result.ok) {
        return result;
      }

      // The delegation from manager should already have what we need
      // But we need to get the authHeader from the delegation endpoint
      // For now, construct a bearer token using the delegation CID
      // TODO: Update once we have proper UCAN token generation
      const delegation = result.data;

      return {
        ok: true,
        data: {
          ...delegation,
          // Note: The delegation manager should return the proper authHeader
          // If not, we may need to call the /delegate endpoint directly
          authHeader: delegation.authHeader ?? `Bearer ${delegation.cid}`,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'DELEGATION_FAILED',
          message: `Failed to create delegation: ${error instanceof Error ? error.message : String(error)}`,
          service: 'delegation',
          cause: error instanceof Error ? error : undefined,
        },
      };
    }
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

    const result = tinycloud.createDelegation(
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
   * Get the session expiry time by parsing the SIWE message.
   * @internal
   */
  private getSessionExpiry(): Date {
    const fullSession = this.webAuth.tinyCloudSession;
    if (fullSession?.siwe) {
      const expirationMatch = fullSession.siwe.match(/Expiration Time: (.+)/);
      if (expirationMatch?.[1]) {
        const parsed = new Date(expirationMatch[1]);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    // Default to 1 hour from now if SIWE parse failure
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  /**
   * Extend the session for sharing by creating a new SIWE delegation.
   * This is called when a share request needs a longer duration than the current session.
   * Only works in new auth mode.
   *
   * @deprecated Use createRootDelegationForSharing instead. This method creates a delegation
   * to the session key, which doesn't actually solve the expiry problem because the share key
   * delegation is still a sub-delegation limited by the session chain.
   * @internal
   */
  private async extendSessionForSharing(
    requestedExpiry: Date,
    hosts: string[]
  ): Promise<{ session: ServiceSession; expiry: Date } | undefined> {
    const fullSession = this.webAuth.tinyCloudSession;
    const address = this.userAuthorization.address();
    const chainId = this.userAuthorization.chainId();

    if (!fullSession || !address || !chainId) {
      return undefined;
    }

    try {
      const host = hosts[0];
      const now = new Date();

      // Use the same abilities as the original session (full KV access)
      const abilities: Record<string, Record<string, string[]>> = {
        kv: {
          "": ["tinycloud.kv/put", "tinycloud.kv/get", "tinycloud.kv/del", "tinycloud.kv/list", "tinycloud.kv/metadata"],
        },
      };

      // Prepare a new session with the requested expiry
      const prepared = prepareSession({
        abilities,
        address: tinycloud.ensureEip55(address),
        chainId,
        domain: new URL(host).hostname,
        issuedAt: now.toISOString(),
        expirationTime: requestedExpiry.toISOString(),
        spaceId: fullSession.spaceId,
        jwk: fullSession.jwk,
      });

      // Sign the new SIWE message with the wallet (will trigger OpenKey popup)
      const signature = await this.userAuthorization.signMessage(prepared.siwe);

      // Complete the session setup
      const newSession = completeSessionSetup({
        ...prepared,
        signature,
      });

      // Activate the new session with the server
      const activateResult = await activateSessionWithHost(host, newSession.delegationHeader);

      if (!activateResult.success) {
        console.warn('Failed to activate extended session:', activateResult.error);
        return undefined;
      }

      // Convert to ServiceSession
      const serviceSession: ServiceSession = {
        delegationHeader: newSession.delegationHeader,
        delegationCid: newSession.delegationCid,
        spaceId: fullSession.spaceId,
        verificationMethod: fullSession.verificationMethod,
        jwk: fullSession.jwk,
      };

      return {
        session: serviceSession,
        expiry: requestedExpiry,
      };
    } catch (err) {
      console.warn('Failed to extend session for sharing:', err);
      return undefined;
    }
  }

  /**
   * Create a direct root delegation from the wallet to a share key.
   * This is the CORRECT solution for long-lived share links.
   *
   * Instead of creating a sub-delegation chain (PKH -> session key -> share key),
   * this creates a DIRECT delegation (PKH -> share key), which is not constrained
   * by the session's expiry time.
   *
   * This will trigger the OpenKey popup to sign a new SIWE message.
   *
   * @param params - Parameters for creating the root delegation
   * @param hosts - TinyCloud host URLs
   * @returns The delegation from wallet to share key, or undefined if failed
   * @internal
   */
  private async createRootDelegationForSharing(
    params: {
      shareKeyDID: string;
      spaceId: string;
      path: string;
      actions: string[];
      requestedExpiry: Date;
    },
    hosts: string[]
  ): Promise<Delegation | undefined> {
    const address = this.userAuthorization.address();
    const chainId = this.userAuthorization.chainId();

    if (!address || !chainId) {
      return undefined;
    }

    try {
      const host = hosts[0];
      const now = new Date();

      // Build abilities for the share key
      // Note: We use the full path as-is (already includes any prefix)
      const abilities: Record<string, Record<string, string[]>> = {
        kv: {
          [params.path]: params.actions,
        },
      };

      // Prepare a NEW delegation directly to the share key
      // Key differences from extendSessionForSharing:
      // 1. delegateUri targets the share key DID directly
      // 2. NO parents - this is a root delegation, not a sub-delegation
      // 3. NO jwk - we're not delegating to our session key
      const prepared = prepareSession({
        abilities,
        address: tinycloud.ensureEip55(address),
        chainId,
        domain: new URL(host).hostname,
        issuedAt: now.toISOString(),
        expirationTime: params.requestedExpiry.toISOString(),
        spaceId: params.spaceId,
        delegateUri: params.shareKeyDID, // Direct delegation to share key
        // NO parents - this is a fresh root delegation from PKH
        // NO jwk - we're delegating to the share key, not our session key
      });

      // Sign the SIWE message with the wallet (will trigger OpenKey popup)
      const signature = await this.userAuthorization.signMessage(prepared.siwe);

      // Complete the session setup to get the delegation header
      const delegationSession = completeSessionSetup({
        ...prepared,
        signature,
      });

      // Activate the delegation with the server
      const activateResult = await activateSessionWithHost(host, delegationSession.delegationHeader);

      if (!activateResult.success) {
        console.warn('Failed to activate root delegation for sharing:', activateResult.error);
        return undefined;
      }

      // Return the delegation
      const delegation: Delegation = {
        cid: delegationSession.delegationCid,
        delegateDID: params.shareKeyDID,
        delegatorDID: `did:pkh:eip155:${chainId}:${address}`,
        spaceId: params.spaceId,
        path: params.path,
        actions: params.actions,
        expiry: params.requestedExpiry,
        isRevoked: false,
        allowSubDelegation: true,
        createdAt: now,
        // Include authHeader for the share link
        authHeader: delegationSession.delegationHeader.Authorization,
      };

      return delegation;
    } catch (err) {
      console.warn('Failed to create root delegation for sharing:', err);
      return undefined;
    }
  }

  /**
   * Create a delegation using SIWE-based flow.
   * This method implements the correct delegation creation pattern:
   * 1. Use prepareSession() to build the delegation
   * 2. Sign the SIWE message with the user's wallet
   * 3. Use completeSessionSetup() to get the delegation header
   * 4. Activate the delegation with the server
   *
   * @param params - Delegation parameters including spaceId
   * @param session - The TinyCloud session
   * @param address - User's address
   * @param chainId - Chain ID
   * @param hosts - TinyCloud host URLs
   * @returns Result containing the created Delegation or an error
   * @internal
   */
  private async createDelegationWithSIWE(
    params: SpaceDelegationParams,
    session: { address: string; chainId: number; delegationCid: string; spaceId: string },
    address: string,
    chainId: number,
    hosts: string[]
  ): Promise<Result<Delegation, ServiceError>> {
    try {
      const host = hosts[0];

      // Build abilities for the delegation
      const abilities: Record<string, Record<string, string[]>> = {
        kv: {
          [params.path]: params.actions,
        },
      };

      const now = new Date();
      const expirationTime = params.expiry ?? new Date(now.getTime() + 60 * 60 * 1000); // Default 1 hour

      // Prepare the delegation session
      const prepared = prepareSession({
        abilities,
        address: address,
        chainId: chainId,
        domain: new URL(host).hostname,
        issuedAt: now.toISOString(),
        expirationTime: expirationTime.toISOString(),
        spaceId: params.spaceId,
        delegateUri: params.delegateDID,
        parents: [session.delegationCid],
      });

      // Sign the SIWE message with the user's wallet
      const signature = await this.userAuthorization.signMessage(prepared.siwe);

      // Complete the session setup to get the delegation header
      const delegationSession = completeSessionSetup({
        ...prepared,
        signature,
      });

      // Activate the delegation with the server
      const activateResult = await activateSessionWithHost(host, delegationSession.delegationHeader);

      if (!activateResult.success) {
        return {
          ok: false,
          error: {
            code: 'DELEGATION_FAILED',
            message: `Failed to activate delegation: ${activateResult.error}`,
            service: 'space',
          },
        };
      }

      // Return the created delegation
      const delegation: Delegation = {
        cid: delegationSession.delegationCid,
        delegateDID: params.delegateDID,
        delegatorDID: `did:pkh:eip155:${chainId}:${address}`,
        spaceId: params.spaceId,
        path: params.path,
        actions: params.actions,
        expiry: expirationTime,
        isRevoked: false,
        allowSubDelegation: !(params.disableSubDelegation ?? false),
        createdAt: now,
        // Include authHeader for sharing links
        authHeader: delegationSession.delegationHeader.Authorization,
      };

      return { ok: true, data: delegation };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'DELEGATION_FAILED',
          message: `Failed to create delegation: ${error instanceof Error ? error.message : String(error)}`,
          service: 'space',
          cause: error instanceof Error ? error : undefined,
        },
      };
    }
  }

  /**
   * Convert TinyCloud session to ServiceSession.
   * Gets session from WebUserAuthorization.
   * @internal
   */
  private toServiceSession(): ServiceSession | null {
    // Get the TinyCloud session from WebUserAuthorization
    const tinycloudSession = this.userAuthorization.getTinycloudSession();
    if (!tinycloudSession) {
      return null;
    }

    return {
      delegationHeader: tinycloudSession.delegationHeader,
      delegationCid: tinycloudSession.delegationCid,
      spaceId: tinycloudSession.spaceId,
      verificationMethod: tinycloudSession.verificationMethod,
      jwk: tinycloudSession.jwk,
    };
  }

  /**
   * Extends TinyCloudWeb with functions that are called after connecting and signing in.
   */
  public extend(extension: Extension): void {
    this.userAuthorization.extend(extension);
  }

  /**
   * Request the user to sign in, and start the session.
   * @returns Object containing information about the session
   */
  public signIn = async (): Promise<ClientSession> => {
    const session = await this.userAuthorization.signIn();
    // Initialize KV service after sign-in
    this.initializeKVService(session);
    return session;
  };

  /**
   * Invalidates user's session.
   */
  public signOut = async (): Promise<void> => {
    // Abort pending operations and clear service context
    if (this._serviceContext) {
      this._serviceContext.abort();
      this._serviceContext.setSession(null);
    }
    // Clear all service instances
    this._kvService = undefined;
    this._serviceContext = undefined;
    // Clear delegation system services
    if (this._capabilityRegistry) {
      this._capabilityRegistry.clear();
    }
    this._capabilityRegistry = undefined;
    this._delegationManager = undefined;
    this._spaceService = undefined;
    this._keyProvider = undefined;
    this._sharingService = undefined;
    return this.userAuthorization.signOut();
  };

  /**
   * Cleanup SDK resources including notification system.
   * Should be called when the SDK is no longer needed.
   */
  public cleanup(): void {
    // Cleanup notification system
    this.errorHandler.cleanup();
    ToastManager.getInstance().clear();

    // Cleanup event dispatcher
    const { dispatchSDKEvent } = require('../notifications');
    if (dispatchSDKEvent.cleanup) {
      dispatchSDKEvent.cleanup();
    }
  }

  /**
   * Gets the session representation (once signed in).
   * @returns Session object.
   */
  public session: () => ClientSession | undefined = () =>
    this.userAuthorization.session;

  /**
   * Gets the address that is connected and signed in.
   * @returns Address.
   */
  public address: () => string | undefined = () =>
    this.userAuthorization.address();

  /**
   * Get the chainId that the address is connected and signed in on.
   * @returns chainId.
   */
  public chainId: () => number | undefined = () =>
    this.userAuthorization.chainId();

  // =========================================================================
  // Auth Module Features
  // =========================================================================

  /**
   * Get the WebUserAuthorization instance.
   */
  public get webAuth(): WebUserAuthorization {
    return this.userAuthorization;
  }

  /**
   * Get the primary DID for this user.
   *
   * - If wallet connected and signed in: returns PKH DID (persistent identity)
   * - If session-only mode: returns session key DID (ephemeral)
   */
  public get did(): string {
    return this.webAuth.did;
  }

  /**
   * Get the session key DID.
   * Always available, even before sign-in.
   *
   * Format: `did:key:z6Mk...#z6Mk...`
   */
  public get sessionDid(): string {
    return this.webAuth.sessionDid;
  }

  /**
   * Check if in session-only mode.
   * Session-only mode means no wallet is connected, but delegations can be received.
   */
  public get isSessionOnly(): boolean {
    return this.webAuth.isSessionOnly;
  }

  /**
   * Check if a wallet is connected.
   * Wallet may be connected but not signed in.
   */
  public get isWalletConnected(): boolean {
    return this.webAuth.isWalletConnected;
  }

  /**
   * Connect a wallet to upgrade from session-only mode (new auth module only).
   *
   * This allows users who started in session-only mode (e.g., received
   * delegations) to later connect a wallet and create their own space.
   *
   * @param provider - Web3 provider (e.g., window.ethereum)
   * @param options - Optional configuration
   *
   * @example
   * ```typescript
   * // Create in session-only mode
   * const tcw = new TinyCloudWeb();
   * console.log(tcw.isSessionOnly); // true
   *
   * // User clicks "Connect Wallet"
   * tcw.connectWallet(window.ethereum);
   * console.log(tcw.isSessionOnly); // false
   *
   * // Now can sign in
   * await tcw.signIn();
   * ```
   */
  public connectWallet(
    provider: providers.ExternalProvider | providers.Web3Provider,
    options?: { spacePrefix?: string }
  ): void {
    this.webAuth.connectWallet(provider, options);
  }

  /**
   * Use a delegation received from another user.
   *
   * This creates a session that chains from the received delegation,
   * allowing operations on the delegator's space.
   *
   * Works in both modes:
   * - **Session-only mode**: Uses the delegation directly (must target session key DID)
   * - **Wallet mode**: Creates a SIWE sub-delegation from PKH to session key
   *
   * @param delegation - The PortableDelegation to use (from createDelegation or transport)
   * @returns A DelegatedAccess instance for performing operations
   *
   * @throws Error if in session-only mode and delegation doesn't target this user's DID
   * @throws Error if in wallet mode and not signed in
   *
   * @example
   * ```typescript
   * // Session-only mode (most common for receiving delegations)
   * const tcw = new TinyCloudWeb();
   * const delegation = deserializeDelegation(receivedData);
   *
   * // The delegation must target tcw.did (session key DID in session-only mode)
   * const access = await tcw.useDelegation(delegation);
   *
   * // Perform KV operations on the delegated space
   * const data = await access.kv.get("shared/document.json");
   * await access.kv.put("shared/notes.txt", "Hello!");
   *
   * // Wallet mode (signed in user receiving delegation)
   * const tcw = new TinyCloudWeb({ providers: { web3: { driver: window.ethereum } } });
   * await tcw.signIn();
   *
   * // The delegation should target tcw.did (PKH DID when signed in)
   * const access = await tcw.useDelegation(delegation);
   * ```
   */
  public async useDelegation(delegation: PortableDelegation): Promise<DelegatedAccess> {
    const delegationHeader = delegation.delegationHeader;

    // Use the host from the delegation if provided, otherwise fall back to config
    const hosts = this.webAuth.getTinycloudHosts();
    const targetHost = delegation.host ?? hosts[0];

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

      // Get the session key JWK
      const sessionKeyJwk = this.webAuth.getSessionKeyJwk();

      // Create a session using the delegation directly
      // In session-only mode, we use the received delegation as-is
      const session: TinyCloudSession = {
        address: delegation.ownerAddress,
        chainId: delegation.chainId,
        sessionKey: JSON.stringify(sessionKeyJwk),
        spaceId: delegation.spaceId,
        delegationCid: delegation.cid,
        delegationHeader,
        verificationMethod: this.sessionDid,
        jwk: sessionKeyJwk,
        siwe: "", // Not used in session-only mode
        signature: "", // Not used in session-only mode
      };

      // Track received delegation in registry if available
      if (this._capabilityRegistry) {
        this.trackReceivedDelegation(delegation, sessionKeyJwk);
      }

      return new DelegatedAccess(session, delegation, targetHost);
    }

    // Wallet mode: create a SIWE sub-delegation
    const mySession = this.webAuth.tinyCloudSession;
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
      address: tinycloud.ensureEip55(mySession.address),
      chainId: mySession.chainId,
      domain: new URL(targetHost).hostname,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      spaceId: delegation.spaceId,
      jwk,
      parents: [delegation.cid],
    });

    // Sign with THIS user's wallet
    // For web-sdk, we need to use the webAuth's signing mechanism
    const signer = this.provider?.getSigner();
    if (!signer) {
      throw new Error("No signer available. Ensure wallet is connected.");
    }
    const signature = await signer.signMessage(prepared.siwe);

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

    // Track received delegation in registry if available
    if (this._capabilityRegistry) {
      this.trackReceivedDelegation(delegation, jwk as unknown as JWK);
    }

    return new DelegatedAccess(session, delegation, targetHost);
  }

  // =========================================================================
  // Delegation Convenience Methods
  // =========================================================================

  /**
   * Convenience method to create a delegation via the delegation manager.
   * For creating PortableDelegations, use createDelegation() instead.
   *
   * @param params - Delegation parameters
   * @returns Result containing the created Delegation or an error
   *
   * @example
   * ```typescript
   * const result = await tcw.delegate({
   *   delegateDID: 'did:pkh:eip155:1:0x...',
   *   path: 'shared/',
   *   actions: ['tinycloud.kv/get', 'tinycloud.kv/put'],
   *   expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
   * });
   *
   * if (result.ok) {
   *   console.log('Delegation created:', result.data.cid);
   * }
   * ```
   */
  async delegate(params: CreateDelegationParams): Promise<Result<Delegation, DelegationError>> {
    if (!this._delegationManager) {
      return { ok: false, error: { code: 'NOT_INITIALIZED', message: 'Not signed in', service: 'delegation' } };
    }
    return this._delegationManager.create(params);
  }

  /**
   * Revoke a delegation by CID.
   *
   * @param cid - The CID of the delegation to revoke
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * const result = await tcw.revokeDelegation('bafy...');
   * if (result.ok) {
   *   console.log('Delegation revoked');
   * }
   * ```
   */
  async revokeDelegation(cid: string): Promise<Result<void, DelegationError>> {
    if (!this._delegationManager) {
      return { ok: false, error: { code: 'NOT_INITIALIZED', message: 'Not signed in', service: 'delegation' } };
    }
    return this._delegationManager.revoke(cid);
  }

  /**
   * List all delegations for the current space.
   *
   * @returns Result containing an array of Delegations
   *
   * @example
   * ```typescript
   * const result = await tcw.listDelegations();
   * if (result.ok) {
   *   console.log('Delegations:', result.data.length);
   * }
   * ```
   */
  async listDelegations(): Promise<Result<Delegation[], DelegationError>> {
    if (!this._delegationManager) {
      return { ok: false, error: { code: 'NOT_INITIALIZED', message: 'Not signed in', service: 'delegation' } };
    }
    return this._delegationManager.list();
  }

  /**
   * Check if the current session has permission for a path and action.
   *
   * @param path - The resource path to check
   * @param action - The action to check (e.g., 'tinycloud.kv/get')
   * @returns Result containing boolean permission status
   *
   * @example
   * ```typescript
   * const result = await tcw.checkPermission('shared/docs', 'tinycloud.kv/get');
   * if (result.ok && result.data) {
   *   console.log('Permission granted');
   * }
   * ```
   */
  async checkPermission(path: string, action: string): Promise<Result<boolean, DelegationError>> {
    if (!this._delegationManager) {
      return { ok: false, error: { code: 'NOT_INITIALIZED', message: 'Not signed in', service: 'delegation' } };
    }
    return this._delegationManager.checkPermission(path, action);
  }

  /**
   * Create a delegation to grant access to another user.
   * Returns a PortableDelegation that can be serialized and sent to the recipient.
   *
   * @param params - Delegation parameters
   * @returns A portable delegation that can be sent to the recipient
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * const delegation = await tcw.createDelegation({
   *   path: "shared/",
   *   actions: ["tinycloud.kv/get", "tinycloud.kv/list"],
   *   delegateDID: recipientDid,
   *   expiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
   * });
   *
   * // Send to recipient
   * const token = serializeDelegation(delegation);
   * ```
   */
  async createDelegation(params: {
    /** Path within the space to delegate access to */
    path: string;
    /** Actions to allow (e.g., ["tinycloud.kv/get", "tinycloud.kv/put"]) */
    actions: string[];
    /** DID of the recipient (from their TinyCloudWeb.did) */
    delegateDID: string;
    /** Whether to prevent the recipient from creating sub-delegations (default: false) */
    disableSubDelegation?: boolean;
    /** Expiration time in milliseconds from now (default: 1 hour) */
    expiryMs?: number;
  }): Promise<PortableDelegation> {
    const session = this.webAuth.tinyCloudSession;
    if (!session) {
      throw new Error("Not signed in. Call signIn() first.");
    }

    // Get hosts from config
    const hosts = this.webAuth.getTinycloudHosts();
    const host = hosts[0];

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
      address: tinycloud.ensureEip55(session.address),
      chainId: session.chainId,
      domain: new URL(host).hostname,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      spaceId: session.spaceId,
      delegateUri: params.delegateDID,
      parents: [session.delegationCid],
    });

    // Sign the SIWE message with this user's wallet
    const signer = this.provider?.getSigner();
    if (!signer) {
      throw new Error("No signer available. Ensure wallet is connected.");
    }
    const signature = await signer.signMessage(prepared.siwe);

    // Complete the session setup
    const delegationSession = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Activate the delegation with the server
    const activateResult = await activateSessionWithHost(
      host,
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
      host,
    };
  }

  /**
   * Track a received delegation in the capability registry.
   * @private
   */
  private trackReceivedDelegation(delegation: PortableDelegation, jwk: JWK): void {
    if (!this._capabilityRegistry) {
      return;
    }

    // Build KeyInfo for the capability registry
    const keyInfo: KeyInfo = {
      id: `received:${delegation.cid}`,
      did: this.sessionDid,
      type: 'ingested',
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
   * Create a sub-delegation from a received delegation.
   * Allows chaining delegations (Alice -> Bob -> Carol).
   *
   * This allows further delegating access that was received from another user,
   * if the original delegation allows sub-delegation.
   *
   * @param parentDelegation - The delegation received from another user
   * @param params - Sub-delegation parameters (must be within parent's scope)
   * @returns A portable delegation for the sub-delegate
   *
   * @throws Error if in session-only mode (requires wallet)
   * @throws Error if not signed in
   * @throws Error if parent delegation does not allow sub-delegation
   * @throws Error if sub-delegation path is outside parent's path
   * @throws Error if sub-delegation actions are not a subset of parent's actions
   *
   * @example
   * ```typescript
   * // Bob received a delegation from Alice
   * const access = await tcw.useDelegation(aliceDelegation);
   *
   * // Bob creates sub-delegation for Carol
   * const subDelegation = await tcw.createSubDelegation(aliceDelegation, {
   *   path: "shared/subset/",
   *   actions: ["tinycloud.kv/get"],
   *   delegateDID: carolDid,
   * });
   * ```
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
    if (this.isSessionOnly) {
      throw new Error(
        "Cannot createSubDelegation() in session-only mode. Requires wallet mode."
      );
    }

    const address = this.address();
    const chainId = this.chainId();
    if (!address || !chainId) {
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
    const expiryMs = params.expiryMs ?? 60 * 60 * 1000; // Default 1 hour
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
    const hosts = this.webAuth.getTinycloudHosts();
    const targetHost = parentDelegation.host ?? hosts[0];

    // Prepare the sub-delegation session
    // Uses THIS user's address (who received the delegation and is now sub-delegating)
    // Targets the recipient's DID (delegateUri)
    // References the parent delegation as the chain
    const prepared = prepareSession({
      abilities,
      address: tinycloud.ensureEip55(address),
      chainId: chainId,
      domain: new URL(targetHost).hostname,
      issuedAt: now.toISOString(),
      expirationTime: actualExpiry.toISOString(),
      spaceId: parentDelegation.spaceId,
      delegateUri: params.delegateDID,
      parents: [parentDelegation.cid],
    });

    // Sign with THIS user's wallet
    const signer = this.provider?.getSigner();
    if (!signer) {
      throw new Error("No signer available. Ensure wallet is connected.");
    }
    const signature = await signer.signMessage(prepared.siwe);

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
      ownerAddress: parentDelegation.ownerAddress,
      chainId: parentDelegation.chainId,
      host: targetHost,
    };
  }

}
