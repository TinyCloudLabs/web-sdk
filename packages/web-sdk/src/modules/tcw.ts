import {
  TCWRPCProviders,
  TCWEnsData,
} from '@tinycloudlabs/web-core';
import {
  IUserAuthorization,
  UserAuthorization,
} from '.';
import {
  TCWClientConfig,
  TCWClientSession,
  TCWExtension,
} from '@tinycloudlabs/web-core/client';
import type { providers, Signer } from 'ethers';
import { SDKErrorHandler, ToastManager } from '../notifications';
import type { NotificationConfig } from '../notifications/types';
import { SiweMessage } from 'siwe';
import {
  ServiceContext,
  KVService,
  IKVService,
  ServiceSession,
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
} from '@tinycloudlabs/sdk-core';
import { invoke } from './Storage/tinycloud/module';

declare global {
  interface Window {
    ethereum?: any;
  }
}

// temporary: will move to tcw-core
interface TCWConfig extends TCWClientConfig {
  notifications?: NotificationConfig;
  /** Optional prefix for KV service keys */
  kvPrefix?: string;
}

const TCW_DEFAULT_CONFIG: TCWClientConfig = {
  providers: {
    web3: {
      driver: globalThis.ethereum,
    },
  },
};

/** TCW: TinyCloud Web SDK
 *
 * An SDK for building user-controlled web apps.
 */
export class TinyCloudWeb {
  /** The Ethereum provider */
  public provider: providers.Web3Provider;

  /** Supported RPC Providers */
  public static RPCProviders = TCWRPCProviders;

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
  public userAuthorization: IUserAuthorization;

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

  constructor(private config: TCWConfig = TCW_DEFAULT_CONFIG) {
    // TODO: pull out config validation into separate function
    // TODO: pull out userAuthorization config
    this.userAuthorization = new UserAuthorization(config);

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
   * Initialize the sdk-services KVService and other services.
   * Called internally after sign-in when the session is established.
   *
   * @internal
   */
  private initializeKVService(session: TCWClientSession): void {
    // Get hosts from userAuthorization or config
    const hosts = this.userAuthorization.getTinycloudHosts?.() ||
                  (this.config as any).tinycloudHosts ||
                  ['https://node.tinycloud.xyz'];

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
    const tinycloudSession = this.userAuthorization.getTinycloudSession?.();
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
    });
  }

  /**
   * Get the session expiry time.
   * @internal
   */
  private getSessionExpiry(): Date {
    // Default to 1 hour from now if not explicitly set
    // The actual expiry is in the SIWE message, but we don't have easy access to it here
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  /**
   * Convert TinyCloud session to ServiceSession.
   * Gets session from UserAuthorization.
   * @internal
   */
  private toServiceSession(): ServiceSession | null {
    // Get the TinyCloud session from UserAuthorization
    const tinycloudSession = this.userAuthorization.getTinycloudSession?.();
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
   * Extends TCW with a functions that are called after connecting and signing in.
   */
  public extend(extension: TCWExtension): void {
    this.userAuthorization.extend(extension);
  }

  /**
   * Request the user to sign in, and start the session.
   * @returns Object containing information about the session
   */
  public signIn = async (): Promise<TCWClientSession> => {
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
   * ENS data supported by TCW.
   * @param address - User address.
   * @param resolveEnsOpts - Options to resolve ENS.
   * @returns Object containing ENS data.
   */
  public async resolveEns(
    /** User address */
    address: string,
  ): Promise<TCWEnsData> {
    return this.userAuthorization.resolveEns(address);
  }

  /**
   * Gets the session representation (once signed in).
   * @returns Address.
   */
  public session: () => TCWClientSession | undefined = () =>
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

  /**
   * Gets the provider that is connected and signed in.
   * @returns Provider.
   */
  public getProvider(): providers.Web3Provider | undefined {
    return this.userAuthorization.provider;
  }

  /**
   * Returns the signer of the connected address.
   * @returns ethers.Signer
   * @see https://docs.ethers.io/v5/api/signer/#Signer
   */
  public getSigner(): Signer {
    return this.userAuthorization.provider.getSigner();
  }

  /**
   * Generates a SIWE message for authentication with session key capabilities.
   * This method delegates to the UserAuthorization module.
   *
   * @param address - Ethereum address performing the signing
   * @param partialSiweMessage - Optional partial SIWE message to override defaults
   * @returns SiweMessage object ready for signing
   */
  public async generateSiweMessage(
    address: string,
    partialSiweMessage?: Partial<SiweMessage>
  ): Promise<SiweMessage> {
    return this.userAuthorization.generateSiweMessage(address, partialSiweMessage);
  }

  /**
   * Sign in using a pre-signed SIWE message.
   * This method delegates to the UserAuthorization module.
   * @param siweMessage - The SIWE message that was generated
   * @param signature - The signature of the SIWE message
   * @returns Object containing information about the session
   */
  public async signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<TCWClientSession> {
    const session = await this.userAuthorization.signInWithSignature(siweMessage, signature);
    // Initialize KV service after sign-in
    this.initializeKVService(session);
    return session;
  }

}
