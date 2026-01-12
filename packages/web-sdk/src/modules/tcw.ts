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
} from '@tinycloudlabs/sdk-core';
import { invoke } from './Storage/tinycloud/module';
import { SharingService } from './SharingService';

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

  /** Sharing Service instance */
  private _sharingService?: SharingService;

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
   * Get the sharing service for generating and retrieving sharing links.
   * Must be signed in for the service to be available.
   *
   * @throws Error if not signed in
   *
   * @example
   * ```typescript
   * // Generate a sharing link
   * const shareData = await tcw.sharing.generate('my-key');
   *
   * // Retrieve shared data
   * const result = await tcw.sharing.retrieve(shareData);
   * if (result.ok) {
   *   console.log(result.data.data);
   * }
   * ```
   */
  public get sharing(): SharingService {
    if (!this._sharingService) {
      throw new Error(
        'Sharing service is not available. Make sure you are signed in first.'
      );
    }
    return this._sharingService;
  }

  /**
   * Initialize the sdk-services KVService.
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

    // Initialize sharing service
    const sessionManager = (this.userAuthorization as any).sessionManager;
    if (sessionManager) {
      this._sharingService = new SharingService({
        userAuth: this.userAuthorization,
        hosts,
        sessionManager,
      });
    }

    // Convert TinyCloud session to ServiceSession and set on context
    const serviceSession = this.toServiceSession();
    if (serviceSession) {
      this._serviceContext.setSession(serviceSession);
    }
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
    this._kvService = undefined;
    this._sharingService = undefined;
    this._serviceContext = undefined;
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

  /**
   * Try to resume a previously persisted session.
   * Initializes KV service if session is successfully resumed.
   *
   * @param address - The wallet address to resume session for
   * @returns The resumed session, or null if no session exists
   */
  public async tryResumeSession(address: string): Promise<TCWClientSession | null> {
    const session = await this.userAuthorization.tryResumeSession(address);
    if (session) {
      // Initialize KV service after session resume
      this.initializeKVService(session);
    }
    return session;
  }
}
