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

  constructor(private config: TCWConfig = TCW_DEFAULT_CONFIG) {
    // TODO: pull out config validation into separate function
    // TODO: pull out userAuthorization config
    this.userAuthorization = new UserAuthorization(config);

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
}
