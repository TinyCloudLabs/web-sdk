import { providers, Signer } from 'ethers';
import { initialized, tcwSession } from '@tinycloudlabs/web-sdk-wasm';
import merge from 'lodash.merge';
import axios, { AxiosInstance } from 'axios';
import { generateNonce } from 'siwe';
import {
  TCWEnsData,
  tcwResolveEns,
  TCWEnsResolveOptions,
} from '@tinycloudlabs/web-core';
import {
  TCWClientSession,
  TCWClientConfig,
  ITCWConnected,
  TCWExtension,
} from '@tinycloudlabs/web-core/client';

/** UserAuthorization Module
 *
 * Handles the capabilities that a user can provide a app, specifically
 * authentication and authorization. This resource handles  all key and
 * signing capabilities including:
 * - ethereum provider, wallet connection, SIWE message creation and signing
 * - session key management
 * - creates, manages, and handles session data
 * - manages/provides capabilities
 */
interface IUserAuthorization {
  /* properties */
  provider: providers.Web3Provider;
  session?: TCWClientSession;

  /* createUserAuthorization */
  extend: (extension: TCWExtension) => void;
  connect(): Promise<any>;
  signIn(): Promise<any>;
  /**
   * ENS data supported by TCW.
   * @param address - User address.
   * @param resolveEnsOpts - Options to resolve ENS.
   * @returns Object containing ENS data.
   */
  resolveEns(
    /** User address */
    address: string,
    resolveEnsOpts: TCWEnsResolveOptions
  ): Promise<TCWEnsData>;
  address(): string | undefined;
  chainId(): number | undefined;
  /**
   * Signs a message using the private key of the connected address.
   * @returns signature;
   */
  signMessage(message: string): Promise<string>;
  getSigner(): Signer;
  /* getUserAuthorization */
  // getSIWE
  // getSessionData
  // getCapabilities
  /* listUserAuthorization */
  /* deleteUserAuthorization */
  signOut(): Promise<any>;
  // signOut()
  /* updateUserAuthorization */
  // requestCapabilities()
}

class UserAuthorizationInit {
  /** Extensions for the TCWClientSession. */
  private extensions: TCWExtension[] = [];

  /** The session representation (once signed in). */
  public session?: TCWClientSession;

  constructor(private config?: TCWClientConfig) {}

  /** Extend the session with an TCW compatible extension. */
  extend(extension: TCWExtension) {
    this.extensions.push(extension);
  }

  /**
   * Connect to the signing account using the configured provider.
   * @returns UserAuthorizationConnected instance.
   */
  async connect(): Promise<UserAuthorizationConnected> {
    let provider: providers.Web3Provider;

    // eslint-disable-next-line no-underscore-dangle
    if (!this.config.providers.web3.driver?._isProvider) {
      try {
        provider = new providers.Web3Provider(
          this.config.providers.web3.driver
        );
      } catch (err) {
        // Provider creation error
        console.error(err);
        throw err;
      }
    } else {
      provider = this.config.providers.web3.driver;
    }

    if (
      !this.config.providers.web3?.driver?.bridge?.includes('walletconnect')
    ) {
      const connectedAccounts = await provider.listAccounts();
      if (connectedAccounts.length === 0) {
        try {
          await provider.send('wallet_requestPermissions', [
            { eth_accounts: {} },
          ]);
        } catch (err) {
          // Permission rejected error
          console.error(err);
          throw err;
        }
      }
    }

    let builder;
    try {
      builder = await initialized.then(
        () => new tcwSession.TCWSessionManager()
      );
    } catch (err) {
      // TCW wasm related error
      console.error(err);
      throw err;
    }

    return new UserAuthorizationConnected(
      builder,
      this.config,
      this.extensions,
      provider
    );
  }
}

/** An intermediate TCW state: connected, but not signed-in. */
class UserAuthorizationConnected implements ITCWConnected {
  /**
   * Promise that is initialized on construction of this class to run the "afterConnect" methods
   * of the extensions.
   */
  public afterConnectHooksPromise: Promise<void>;

  /** Verifies if extension is enabled. */
  public isExtensionEnabled = (namespace: string) =>
    this.extensions.filter(e => e.namespace === namespace).length === 1;

  /** Axios instance. */
  public api?: AxiosInstance;

  /** Ethereum Provider */

  constructor(
    /** Instance of TCWSessionManager */
    public builder: tcwSession.TCWSessionManager,
    /** TCWConfig object. */
    public config: TCWClientConfig,
    /** Enabled extensions. */
    public extensions: TCWExtension[],
    /** EthersJS provider. */
    public provider: providers.Web3Provider
  ) {
    this.afterConnectHooksPromise = this.applyExtensions();
    // this.provider = provider;
  }

  /** Applies the "afterConnect" methods and the delegated capabilities of the extensions. */
  public async applyExtensions(): Promise<void> {
    for (const extension of this.extensions) {
      if (extension.afterConnect) {
        const overrides = await extension.afterConnect(this);
        this.config = {
          ...this.config,
          siweConfig: { ...this.config?.siweConfig, ...overrides?.siwe },
        };
      }

      if (extension.namespace && extension.defaultActions) {
        const defaults = await extension.defaultActions();
        this.builder.addDefaultActions(extension.namespace, defaults);
      }

      if (extension.namespace && extension.extraFields) {
        const defaults = await extension.extraFields();
        this.builder.addExtraFields(extension.namespace, defaults);
      }

      if (extension.namespace && extension.targetedActions) {
        const targetedActions = await extension.targetedActions();
        for (const target in targetedActions) {
          this.builder.addTargetedActions(
            extension.namespace,
            target,
            targetedActions[target]
          );
        }
      }
    }
  }

  /**
   * Applies the "afterSignIn" methods of the extensions.
   * @param session - TCWClientSession object.
   */
  public async afterSignIn(session: TCWClientSession): Promise<void> {
    for (const extension of this.extensions) {
      if (extension.afterSignIn) {
        await extension.afterSignIn(session);
      }
    }
  }

  /**
   * Requests the user to sign in.
   * Generates the SIWE message for this session, requests the configured
   * Signer to sign the message, calls the "afterSignIn" methods of the
   * extensions.
   * @returns Promise with the TCWClientSession object.
   */
  async signIn(): Promise<TCWClientSession> {
    await this.afterConnectHooksPromise;
    const sessionKey = this.builder.jwk();
    if (sessionKey === undefined) {
      return Promise.reject(new Error('unable to retrieve session key'));
    }
    const signer = await this.provider.getSigner();
    const walletAddress = await signer.getAddress();
    const defaults = {
      address: this.config.siweConfig?.address ?? walletAddress,
      walletAddress,
      chainId: await this.provider.getSigner().getChainId(),
      domain: globalThis.location.hostname,
      issuedAt: new Date().toISOString(),
      nonce: generateNonce(),
    };

    const siweConfig = merge(defaults, this.config.siweConfig);
    const siwe = await this.builder.build(siweConfig);
    const signature = await signer.signMessage(siwe);

    let session = {
      address: siweConfig.address,
      walletAddress,
      chainId: siweConfig.chainId,
      sessionKey,
      siwe,
      signature,
    };

    await this.afterSignIn(session);

    return session;
  }

  /**
   * Requests the user to sign out.
   * @param session - TCWClientSession object.
   */
  async signOut(session: TCWClientSession): Promise<void> {
    // TODO: kill sessions
  }
}
const TCW_DEFAULT_CONFIG: TCWClientConfig = {
  providers: {
    web3: {
      driver: globalThis.ethereum,
    },
  },
};

class UserAuthorization implements IUserAuthorization {
  /** The Ethereum provider */
  public provider: providers.Web3Provider;

  /** The session representation (once signed in). */
  public session?: TCWClientSession;

  /** TCWClientSession builder. */
  private init: UserAuthorizationInit;

  /** Current connection of TCW */
  private connection?: UserAuthorizationConnected;

  /** The TCWClientConfig object. */
  private config: TCWClientConfig;

  constructor(private _config: TCWClientConfig = TCW_DEFAULT_CONFIG) {
    this.config = _config;
    this.init = new UserAuthorizationInit({
      ...this.config,
      providers: {
        ...TCW_DEFAULT_CONFIG.providers,
        ...this.config?.providers,
      },
    });
  }

  /**
   * Extends TCW with a functions that are called after connecting and signing in.
   */
  public extend(extension: TCWExtension): void {
    this.init.extend(extension);
  }

  public async connect(): Promise<void> {
    if (this.connection) {
      return;
    }
    try {
      this.connection = await this.init.connect();
      this.provider = this.connection.provider;
    } catch (err) {
      // ERROR:
      // Something went wrong when connecting or creating Session (wasm)
      console.error(err);
      throw err;
    }
  }

  public async signIn(): Promise<TCWClientSession> {
    await this.connect();

    try {
      this.session = await this.connection.signIn();
    } catch (err) {
      console.error(err);
      throw err;
    }
    const promises = [];

    if (this.config.resolveEns) {
      promises.push(this.resolveEns(this.session.address));
    }

    // refactor: only resolve ens
    await Promise.all(promises).then(([ens]) => {
      if (ens) {
        this.session.ens = ens;
      }
    });

    return this.session;
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
    resolveEnsOpts: TCWEnsResolveOptions = {
      domain: true,
      avatar: true,
    }
  ): Promise<TCWEnsData> {
    return tcwResolveEns(this.connection.provider, address, resolveEnsOpts);
  }

  /**
   * Invalidates user's session.
   */
  public async signOut(): Promise<void> {
    try {
      await this.connection.signOut(this.session);
    } catch (err) {
      // request to /tcw-logout went wrong
      console.error(err);
      throw err;
    }
    this.session = undefined;
    this.connection = undefined;
  }

  /**
   * Gets the address that is connected and signed in.
   * @returns Address.
   */
  public address: () => string | undefined = () => this.session?.address;

  /**
   * Get the chainId that the address is connected and signed in on.
   * @returns chainId.
   */
  public chainId: () => number | undefined = () => this.session?.chainId;

  /**
   * Signs a message using the private key of the connected address.
   * @returns signature;
   */
  public async signMessage(message: string): Promise<string> {
    return (await this.provider.getSigner()).signMessage(message);
  }

  /**
   * Gets the provider that is connected and signed in.
   * @returns Provider.
   */
  public getProvider(): providers.Web3Provider | undefined {
    return this.provider;
  }

  /**
   * Returns the signer of the connected address.
   * @returns ethers.Signer
   * @see https://docs.ethers.io/v5/api/signer/#Signer
   */
  public getSigner(): Signer {
    return this.provider.getSigner();
  }
}

export {
  IUserAuthorization,
  UserAuthorization,
  UserAuthorizationInit,
  UserAuthorizationConnected,
};
