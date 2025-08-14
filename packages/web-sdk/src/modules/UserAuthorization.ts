import { providers, Signer } from 'ethers';
import { initialized, tcwSession } from '@tinycloudlabs/web-sdk-wasm';
import merge from 'lodash.merge';
import { AxiosInstance } from 'axios';
import { generateNonce, SiweMessage } from 'siwe';
import {
  TCWEnsData,
  tcwResolveEns,
} from '@tinycloudlabs/web-core';
import {
  TCWClientSession,
  TCWClientConfig,
  ITCWConnected,
  TCWExtension,
} from '@tinycloudlabs/web-core/client';
import { dispatchSDKEvent } from '../notifications/ErrorHandler';
import { WasmInitializer } from './WasmInitializer';
import {
  SessionPersistence,
  PersistedSession,
  SessionPersistenceConfig
} from './SessionPersistence';

/**
 * Interface for tracking session state during SIWE message generation
 */
interface PendingSession {
  /** Instance of TCWSessionManager */
  sessionManager: tcwSession.TCWSessionManager;
  /** Ethereum address for the session */
  address: string;
  /** Timestamp when session was generated */
  generatedAt: number;
  /** Extensions that were applied to the session */
  extensions: TCWExtension[];
}

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
  /**
   * Generates a SIWE message for authentication with session key capabilities.
   * @param address - Ethereum address performing the signing
   * @param partialSiweMessage - Optional partial SIWE message to override defaults
   * @returns SiweMessage object ready for signing
   */
  generateSiweMessage(
    address: string,
    partialSiweMessage?: Partial<SiweMessage>
  ): Promise<SiweMessage>;
  /**
   * Sign in to the SDK using a pre-signed SIWE message.
   * @param siweMessage - The SIWE message that was generated
   * @param signature - The signature of the SIWE message
   * @returns Promise with the TCWClientSession object
   */
  signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<TCWClientSession>;
  /**
   * Attempts to resume a previously saved session.
   * @param address - Ethereum address to resume session for
   * @returns Promise with the TCWClientSession object or null if no valid session
   */
  tryResumeSession(address: string): Promise<TCWClientSession | null>;
  /**
   * Clears the persisted session for the given address.
   * @param address - Ethereum address
   */
  clearPersistedSession(address?: string): Promise<void>;
  /**
   * Checks if a session is persisted for the given address.
   * @param address - Ethereum address
   * @returns true if session is persisted
   */
  isSessionPersisted(address: string): boolean;
}

class UserAuthorizationInit {
  /** Extensions for the TCWClientSession. */
  public extensions: TCWExtension[] = [];

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
        dispatchSDKEvent.error('auth.provider_creation_failed',
          'Failed to create Web3 provider',
          err.message);
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
          if (err.code === 4001) {
            dispatchSDKEvent.error('auth.signature_rejected',
              'User rejected the wallet connection request');
          } else if (err.code === -32002) {
            dispatchSDKEvent.error('auth.wallet_not_connected',
              'Please connect your wallet to continue');
          } else {
            dispatchSDKEvent.error('auth.permission_denied',
              'Failed to get wallet permissions',
              err.message);
          }
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
      dispatchSDKEvent.error('wasm.initialization_failed',
        'Failed to initialize security module',
        err.message);
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
    // Ensure WASM modules are initialized before calling extension hooks
    await WasmInitializer.ensureInitialized();

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

    const signer = this.provider.getSigner();
    const walletAddress = await signer.getAddress();
    const chainId = await this.provider.getSigner().getChainId();

    const defaults = {
      address: this.config.siweConfig?.address ?? walletAddress,
      walletAddress,
      chainId,
      domain: globalThis.location.hostname,
      issuedAt: new Date().toISOString(),
      nonce: generateNonce(),
    };

    const siweConfig = merge(defaults, this.config.siweConfig);
    const siwe = this.builder.build(siweConfig);
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

  /** Pending session state for signature-based initialization */
  private pendingSession?: PendingSession;

  /** Session persistence handler */
  private sessionPersistence: SessionPersistence;

  constructor(private _config: TCWClientConfig = TCW_DEFAULT_CONFIG) {
    this.config = _config;
    this.init = new UserAuthorizationInit({
      ...this.config,
      providers: {
        ...TCW_DEFAULT_CONFIG.providers,
        ...this.config?.providers,
      },
    });

    // Initialize session persistence
    this.sessionPersistence = new SessionPersistence(this.config.persistence);
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
      dispatchSDKEvent.error('auth.connection_failed',
        'Failed to establish wallet connection',
        err.message);
      throw err;
    }
  }

  public async signIn(): Promise<TCWClientSession> {
    await this.connect();

    // Check if automatic session resumption is enabled
    const autoResumeEnabled = this.sessionPersistence.configuration.autoResumeSession;

    if (autoResumeEnabled) {
      try {
        // Get the current wallet address to check for existing sessions
        const currentAddress = await this.provider.getSigner().getAddress();

        // Try to resume an existing session
        const resumedSession = await this.tryResumeSession(currentAddress);

        if (resumedSession) {
          // Session resumed successfully
          this.session = resumedSession;

          // Handle ENS resolution for resumed session
          const promises = [];
          if (this.config.resolveEns) {
            promises.push(this.resolveEns(this.session.address));
          }

          await Promise.all(promises).then(([ens]) => {
            if (ens) {
              this.session.ens = ens;
            }
          });

          dispatchSDKEvent.success('Successfully resumed existing session');
          return this.session;
        }
      } catch (error) {
        // Resume failed, continue with normal sign-in flow
        console.warn('Session resumption failed, proceeding with normal sign-in:', error);
      }
    }

    // Normal sign-in flow (when auto-resume is disabled or resumption failed)
    try {
      this.session = await this.connection.signIn();
    } catch (err) {
      console.error(err);
      if (err.code === 4001) {
        dispatchSDKEvent.error('auth.signature_rejected',
          'Signature was rejected. Please try again');
      } else {
        dispatchSDKEvent.error('auth.signin_failed',
          'Failed to sign in',
          err.message);
      }
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

    // Persist session after successful sign-in
    await this.persistSession(this.session);

    dispatchSDKEvent.success('Successfully signed in');

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
  ): Promise<TCWEnsData> {
    return tcwResolveEns(this.connection.provider, address);
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
      dispatchSDKEvent.error('auth.signout_failed',
        'Failed to sign out',
        err.message);
      throw err;
    }

    // Clear persisted session
    if (this.session) {
      await this.sessionPersistence.clearSession(this.session.address);
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

  /**
   * Generates a SIWE message for authentication with session key capabilities.
   * This method initializes a TCWSessionManager, generates a session key,
   * applies extension capabilities, and builds a SIWE message for signing.
   * 
   * @param address - Ethereum address performing the signing
   * @param partialSiweMessage - Optional partial SIWE message to override defaults
   * @returns SiweMessage object ready for signing
   */
  public async generateSiweMessage(
    address: string,
    partialSiweMessage?: Partial<SiweMessage>
  ): Promise<SiweMessage> {
    try {
      // Validate address format
      if (!address || !address.startsWith('0x') || address.length !== 42) {
        throw new Error('Invalid Ethereum address format. Address must be a valid 0x-prefixed hex string.');
      }

      // Initialize TCWSessionManager from WASM
      let sessionManager: tcwSession.TCWSessionManager;
      try {
        sessionManager = await initialized.then(
          () => new tcwSession.TCWSessionManager()
        );
      } catch (error) {
        throw new Error('Failed to initialize WASM session manager. Please try again.');
      }

      // Generate session key and store in manager
      let sessionKey: string;
      try {
        sessionKey = sessionManager.createSessionKey();
        if (!sessionKey) {
          throw new Error('Session key is empty or undefined');
        }
      } catch (error) {
        throw new Error('Failed to generate session key from WASM manager');
      }

      // Apply extension capabilities
      const extensions = this.init.extensions;
      try {
        await this.applyExtensionCapabilities(sessionManager, extensions);
      } catch (error) {
        console.warn('Extension capability application failed:', error);
        // Continue with session generation as extension capabilities are not critical
      }

      // Build SIWE message with defaults
      const domain = partialSiweMessage?.domain || (typeof window !== 'undefined' ? window.location.host : 'localhost');
      const nonce = partialSiweMessage?.nonce || generateNonce();
      const issuedAt = new Date().toISOString();

      const siweMessageData = {
        address,
        chainId: 1, // hardcoded as per requirements
        domain,
        nonce,
        issuedAt,
        uri: partialSiweMessage?.uri || `https://${domain}`,
        version: '1',
        ...partialSiweMessage, // Override with any provided partial data
      };

      // Store session state for later retrieval
      this.pendingSession = {
        sessionManager,
        address,
        generatedAt: Date.now(),
        extensions,
      };

      // Return SiweMessage instance
      return new SiweMessage(siweMessageData);

    } catch (error) {
      // Clean up any partial state on error
      this.pendingSession = undefined;

      console.error('Failed to generate SIWE message:', error);
      throw error;
    }
  }

  /**
   * Sign in to the SDK using a pre-signed SIWE message.
   * This method must be called after generateSiweMessage().
   * @param siweMessage - The SIWE message that was generated
   * @param signature - The signature of the SIWE message
   * @returns Promise with the TCWClientSession object
   */
  public async signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<TCWClientSession> {
    // Validate that generateSiweMessage() was called first
    if (!this.pendingSession) {
      throw new Error('generateSiweMessage() must be called before signInWithSignature()');
    }

    try {
      // Retrieve stored session key from TCWSessionManager
      const sessionKey = this.pendingSession.sessionManager.jwk();
      if (sessionKey === undefined) {
        throw new Error('unable to retrieve session key from pending session');
      }

      // Create TCWClientSession object
      const session: TCWClientSession = {
        address: siweMessage.address,
        walletAddress: siweMessage.address, // For signature-based init, address and walletAddress are the same
        chainId: siweMessage.chainId || 1, // Default to mainnet if not specified
        sessionKey,
        siwe: siweMessage.prepareMessage(),
        signature,
      };

      // Apply extension afterSignIn hooks
      await this.applyAfterSignInHooks(session);

      // Set session to completed session
      this.session = session;

      // Clean up pendingSession after successful initialization
      this.pendingSession = undefined;

      // Return the session object
      return session;

    } catch (error) {
      // Clean up pendingSession on error
      this.pendingSession = undefined;
      throw error;
    }
  }

  /**
   * Applies extension capabilities (defaultActions/targetedActions) to the session manager.
   * This method iterates through the extensions and adds their capabilities to the TCWSessionManager.
   * 
   * @private
   * @param sessionManager - TCWSessionManager instance to apply capabilities to
   * @param extensions - Array of extensions to apply
   */
  private async applyExtensionCapabilities(
    sessionManager: tcwSession.TCWSessionManager,
    extensions: TCWExtension[]
  ): Promise<void> {
    for (const extension of extensions) {
      // Apply default actions if available
      if (extension.namespace && extension.defaultActions) {
        try {
          const defaults = await extension.defaultActions();
          sessionManager.addDefaultActions(extension.namespace, defaults);
        } catch (error) {
          console.warn(`Failed to apply default actions for ${extension.namespace}:`, error);
          // Continue processing other extensions rather than failing completely
        }
      }

      // Apply targeted actions if available
      if (extension.namespace && extension.targetedActions) {
        try {
          const targetedActions = await extension.targetedActions();
          for (const target in targetedActions) {
            sessionManager.addTargetedActions(
              extension.namespace,
              target,
              targetedActions[target]
            );
          }
        } catch (error) {
          console.warn(`Failed to apply targeted actions for ${extension.namespace}:`, error);
          // Continue processing other extensions rather than failing completely
        }
      }
    }
  }

  /**
   * Attempts to resume a previously saved session.
   * @param address - Ethereum address to resume session for
   * @returns Promise with the TCWClientSession object or null if no valid session
   */
  public async tryResumeSession(address: string): Promise<TCWClientSession | null> {
    try {
      const persistedSession = await this.sessionPersistence.loadSession(address);

      if (!persistedSession) {
        return null;
      }

      this.session = {
        address: persistedSession.address,
        walletAddress: persistedSession.address,
        chainId: persistedSession.chainId,
        sessionKey: persistedSession.sessionKey,
        siwe: persistedSession.siwe,
        signature: persistedSession.signature,
      };

      await WasmInitializer.ensureInitialized();
      await this.applyAfterSignInHooks(this.session);

      return this.session;
    } catch (error) {
      console.warn('Failed to resume session:', error);
      await this.sessionPersistence.clearSession(address);
      return null;
    }
  }

  /**
   * Clears the persisted session for the given address.
   * @param address - Ethereum address (optional, uses current session if not provided)
   */
  public async clearPersistedSession(address?: string): Promise<void> {
    const targetAddress = address || this.session?.address;

    if (targetAddress) {
      await this.sessionPersistence.clearSession(targetAddress);
    }
  }

  /**
   * Checks if a session is persisted for the given address.
   * @param address - Ethereum address
   * @returns true if session is persisted
   */
  public isSessionPersisted(address: string): boolean {
    // This is a synchronous check - we can't await here
    // We'll implement a simple storage key check
    try {
      const storageKey = `tinycloud_session_${address.toLowerCase()}`;
      const storage = localStorage || sessionStorage;
      return storage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Persists the current session to storage
   * @param session - The TCWClientSession to persist
   */
  private async persistSession(session: TCWClientSession): Promise<void> {
    try {
      const existingSession = await this.sessionPersistence.loadSession(session.address);

      if (existingSession) {
        existingSession.address = session.address;
        existingSession.chainId = session.chainId;
        existingSession.sessionKey = session.sessionKey;
        existingSession.siwe = session.siwe;
        existingSession.signature = session.signature;

        await this.sessionPersistence.saveSession(existingSession);
      } else {
        const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const persistedSession: PersistedSession = {
          address: session.address,
          chainId: session.chainId,
          sessionKey: session.sessionKey,
          siwe: session.siwe,
          signature: session.signature,
          expiresAt: expirationTime,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
        };

        await this.sessionPersistence.saveSession(persistedSession);
      }
    } catch (error) {
      console.warn('Failed to persist session:', error);
    }
  }

  /**
   * Apply extension afterSignIn hooks to the session.
   * @param session - The TCWClientSession object
   */
  private async applyAfterSignInHooks(session: TCWClientSession): Promise<void> {
    const extensions = this.init.extensions;

    for (const extension of extensions) {
      if (extension.afterSignIn) {
        await extension.afterSignIn(session);
      }
    }
  }
}

export {
  IUserAuthorization,
  UserAuthorization,
  UserAuthorizationInit,
  UserAuthorizationConnected,
  PendingSession,
};
