import {
  TCWRPCProviders,
  TCWEnsData,
} from '@tinycloudlabs/web-core';
import {
  IUserAuthorization,
  TinyCloudStorage,
  UserAuthorization,
} from './modules';
import {
  TCWClientConfig,
  TCWClientSession,
  TCWExtension,
} from '@tinycloudlabs/web-core/client';
import type { providers, Signer } from 'ethers';
import { SDKErrorHandler, ToastManager } from './notifications';
import type { NotificationConfig, ToastPosition } from './notifications/types';
import { SiweMessage } from 'siwe';

declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * Configuration for managing TCW Modules
 */
interface TCWModuleConfig {
  storage?: boolean | { [key: string]: any };
}

// temporary: will move to tcw-core
interface TCWConfig extends TCWClientConfig {
  modules?: TCWModuleConfig;
  notifications?: NotificationConfig;
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

  /** Storage Module */
  public storage: TinyCloudStorage;

  /** Error Handler for Notifications */
  private errorHandler: SDKErrorHandler;

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

    // initialize storage module

    // assume storage module default 
    const storageConfig =
      config?.modules?.storage === undefined ? true : config.modules.storage;

    if (storageConfig !== false) {
      if (typeof storageConfig === 'object') {
        // Initialize storage with the provided config
        this.storage = new TinyCloudStorage(storageConfig, this.userAuthorization);
      } else {
        // storage == true or undefined
        // Initialize storage with default config when no other condition is met
        this.storage = new TinyCloudStorage(
          { prefix: 'default' },
          this.userAuthorization
        );
      }
      this.extend(this.storage);
    }
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
    return this.userAuthorization.signIn();
  };

  /**
   * Invalidates user's session.
   */
  public signOut = async (): Promise<void> => {
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
    const { dispatchSDKEvent } = require('./notifications');
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
   * Initialize the SDK session using a pre-signed SIWE message.
   * This method delegates to the UserAuthorization module.
   * @param siweMessage - The SIWE message that was generated
   * @param signature - The signature of the SIWE message
   */
  public async initializeWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<void> {
    return this.userAuthorization.initializeWithSignature(siweMessage, signature);
  }
}
