import { providers, Signer } from "ethers";
import { initialized, tcwSession } from "@tinycloudlabs/web-sdk-wasm";
import merge from "lodash.merge";
import { AxiosInstance } from "axios";
import { generateNonce, SiweMessage } from "siwe";
import { TCWEnsData, tcwResolveEns } from "@tinycloudlabs/web-core";
import type {
  TCWClientSession,
  TCWClientConfig,
  ITCWConnected,
  TCWExtension,
} from "@tinycloudlabs/web-core/client";
import {
  IUserAuthorization as ICoreUserAuthorization,
  SiweMessage as CoreSiweMessage,
  PartialSiweMessage,
  fetchPeerId,
  submitHostDelegation,
  activateSessionWithHost,
} from "@tinycloudlabs/sdk-core";
import { dispatchSDKEvent } from "../notifications/ErrorHandler";
import { WasmInitializer } from "./WasmInitializer";
import { debug } from "../utils/debug";
import { showSpaceCreationModal, showNodeSelectionModal } from "../notifications/ModalManager";
import {
  generateHostSIWEMessage,
  siweToDelegationHeaders,
  makeSpaceId,
  completeSessionSetup,
} from "./Storage/tinycloud/module";
import { SpaceConnection, Authenticator, Session } from "./Storage/tinycloud";
import Registry from "./registry/index";
import { multiaddrToUri } from "@multiformats/multiaddr-to-uri";

/**
 * Extended TCW Client Config with TinyCloud options
 */
declare module "@tinycloudlabs/web-core/client" {
  interface TCWClientConfig {
    /** Whether to automatically create space if it doesn't exist (default: true) */
    autoCreateSpace?: boolean;
    /** TinyCloud server endpoints (default: ["https://node.tinycloud.xyz"]) */
    tinycloudHosts?: string[];
    /** Space prefix for new sessions (default: "default") */
    spacePrefix?: string;
  }
}

/**
 * Interface for tracking session state during SIWE message generation
 */
interface PendingSession {
  /** Instance of TCWSessionManager (null if consumed by build()) */
  sessionManager: tcwSession.TCWSessionManager | null;
  /** Session key JWK string (stored before build() consumes sessionManager) */
  sessionKey?: string;
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
    address: string
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
   * @param partial - Optional partial SIWE message to override defaults
   * @returns SiweMessage object ready for signing
   */
  generateSiweMessage(
    address: string,
    partial?: PartialSiweMessage
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
   * Get the space ID for the current session.
   * @returns Space ID or undefined if not available
   */
  getSpaceId(): string | undefined;
  /**
   * Get the configured TinyCloud host URLs.
   * @returns Array of TinyCloud host URLs
   */
  getTinycloudHosts(): string[];
  /**
   * Ensure the user's space exists on the TinyCloud server.
   * Creates the space if it doesn't exist (when autoCreateSpace is true).
   */
  ensureSpaceExists(): Promise<void>;
  /**
   * Get the active space connection.
   * This provides access to the user's TinyCloud space for storage operations.
   * @returns SpaceConnection instance
   * @throws Error if not signed in or space connection not established
   */
  spaceConnection: SpaceConnection;
  /**
   * Get the active TinyCloud session.
   * This provides access to the session for authenticated requests.
   * @returns Session object or undefined if not signed in
   */
  getTinycloudSession(): Session | undefined;
}

class UserAuthorizationInit {
  /** Extensions for the TCWClientSession. */
  public extensions: TCWExtension[] = [];

  /** The session representation (once signed in). */
  public session?: TCWClientSession;

  constructor(private config?: TCWClientConfig) { }

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
        debug.error(err);
        dispatchSDKEvent.error(
          "auth.provider_creation_failed",
          "Failed to create Web3 provider",
          err.message
        );
        throw err;
      }
    } else {
      provider = this.config.providers.web3.driver;
    }

    if (
      !this.config.providers.web3?.driver?.bridge?.includes("walletconnect")
    ) {
      const connectedAccounts = await provider.listAccounts();
      if (connectedAccounts.length === 0) {
        try {
          await provider.send("wallet_requestPermissions", [
            { eth_accounts: {} },
          ]);
        } catch (err) {
          // Permission rejected error
          debug.error(err);
          if (err.code === 4001) {
            dispatchSDKEvent.error(
              "auth.signature_rejected",
              "User rejected the wallet connection request"
            );
          } else if (err.code === -32002) {
            dispatchSDKEvent.error(
              "auth.wallet_not_connected",
              "Please connect your wallet to continue"
            );
          } else {
            dispatchSDKEvent.error(
              "auth.permission_denied",
              "Failed to get wallet permissions",
              err.message
            );
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
      debug.error(err);
      dispatchSDKEvent.error(
        "wasm.initialization_failed",
        "Failed to initialize security module",
        err.message
      );
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
    this.extensions.filter((e) => e.namespace === namespace).length === 1;

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

  /**
   * Default KV actions for TinyCloud services.
   * These are added to every session to enable basic KV operations.
   */
  private static readonly DEFAULT_KV_ACTIONS = [
    "tinycloud.kv/put",
    "tinycloud.kv/get",
    "tinycloud.kv/list",
    "tinycloud.kv/del",
    "tinycloud.kv/metadata",
  ];

  /**
   * Default capabilities actions (for reading user capabilities).
   */
  private static readonly DEFAULT_CAPABILITIES_ACTIONS = [
    "tinycloud.capabilities/read",
  ];

  /** Applies the "afterConnect" methods and the delegated capabilities of the extensions. */
  public async applyExtensions(): Promise<void> {
    // Ensure WASM modules are initialized before calling extension hooks
    await WasmInitializer.ensureInitialized();

    // NOTE: Default KV capabilities are added in signIn() after we have address/chainId
    // to build proper resource URIs for ReCap.

    // Apply extension capabilities
    for (const extension of this.extensions) {
      if (extension.afterConnect) {
        const overrides = await extension.afterConnect(this);
        this.config = {
          ...this.config,
          siweConfig: { ...this.config?.siweConfig, ...overrides?.siwe },
        };
      }

      if (extension.targetedActions) {
        const targetedActions = await extension.targetedActions();
        for (const target in targetedActions) {
          this.builder.addTargetedActions(target, targetedActions[target]);
        }
      }
    }
  }

  /**
   * Adds default KV capabilities for the given user address and chainId.
   * Must be called after we have address/chainId but before build().
   * @param address - User's Ethereum address
   * @param chainId - Chain ID
   * @param prefix - Space prefix (default: "default")
   */
  public addDefaultCapabilities(address: string, chainId: number, prefix: string = "default"): void {
    // Use makeSpaceId to ensure consistent spaceId format with setupSpaceSession
    // This is critical - the spaceId in capabilities must match the session spaceId
    const spaceId = makeSpaceId(address, chainId, prefix);

    // Add KV capabilities for default path
    // Note: path should be empty to match what KVService requests (spaceId/kv/)
    const kvTarget = `${spaceId}/kv/`;
    this.builder.addTargetedActions(kvTarget, UserAuthorizationConnected.DEFAULT_KV_ACTIONS);

    // Add capabilities access
    const capabilitiesTarget = `${spaceId}/capabilities/all/`;
    this.builder.addTargetedActions(capabilitiesTarget, UserAuthorizationConnected.DEFAULT_CAPABILITIES_ACTIONS);
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
      return Promise.reject(new Error("unable to retrieve session key"));
    }

    const signer = this.provider.getSigner();
    const walletAddress = await signer.getAddress();
    const chainId = await this.provider.getSigner().getChainId();

    // Add default KV capabilities now that we have address/chainId
    // This must be called before build() which creates the SIWE message with ReCap
    const address = this.config.siweConfig?.address ?? walletAddress;
    const spacePrefix = this.config?.spacePrefix ?? "default";
    this.addDefaultCapabilities(address, chainId, spacePrefix);

    const defaults = {
      address,
      walletAddress,
      chainId,
      domain: globalThis.location.hostname,
      issuedAt: new Date().toISOString(),
      nonce: generateNonce(),
    };

    const siweConfig = merge(defaults, this.config.siweConfig);
    const siwe = this.builder.build(siweConfig);
    debug.log(siwe);
    const signature = await signer.signMessage(siwe);

    let session = {
      address: siweConfig.address,
      walletAddress,
      chainId: siweConfig.chainId,
      sessionKey,
      siwe,
      signature,
    };

    // Note: Extension afterSignIn hooks are called by UserAuthorization.signIn()
    // AFTER space setup, not here. This ensures space exists before extensions run.
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

class UserAuthorization implements IUserAuthorization, ICoreUserAuthorization {
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

  /** Whether to automatically create space if it doesn't exist */
  private autoCreateSpace: boolean;

  /** TinyCloud server endpoints */
  private tinycloudHosts: string[];

  /** Space prefix for new sessions */
  private spacePrefix: string;

  /** The space ID for the current session */
  private _spaceId?: string;

  /** Delegation header for the current session */
  private _delegationHeader?: { Authorization: string };

  /** The TinyCloud session containing delegation and space info */
  private _tinycloudSession?: Session;

  /** The connection to the user's space */
  private _spaceConnection?: SpaceConnection;

  constructor(private _config: TCWClientConfig = TCW_DEFAULT_CONFIG) {
    this.config = _config;
    this.init = new UserAuthorizationInit({
      ...this.config,
      providers: {
        ...TCW_DEFAULT_CONFIG.providers,
        ...this.config?.providers,
      },
    });


    //
    // Initialize space-related options with defaults
    this.autoCreateSpace = _config.autoCreateSpace ?? true;
    this.tinycloudHosts = _config.tinycloudHosts ? [..._config.tinycloudHosts, "https://node.tinycloud.xyz"] : ["https://node.tinycloud.xyz"];
    this.spacePrefix = _config.spacePrefix ?? "default";
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
      const registry = new Registry({
        provider: this.provider
      });

      let node =
        await registry.addressNode()

      this.tinycloudHosts = [node, ...this.tinycloudHosts]
    } catch (err) {
      // ERROR:
      // Something went wrong when connecting or creating Session (wasm)
      debug.error(err);
      dispatchSDKEvent.error(
        "auth.connection_failed",
        "Failed to establish wallet connection",
        err.message
      );
      throw err;
    }
  }

  public async signIn(): Promise<TCWClientSession> {
    await this.connect();

    try {
      this.session = await this.connection.signIn();
    } catch (err) {
      debug.error(err);
      if (err.code === 4001) {
        dispatchSDKEvent.error(
          "auth.signature_rejected",
          "Signature was rejected. Please try again"
        );
      } else {
        dispatchSDKEvent.error(
          "auth.signin_failed",
          "Failed to sign in",
          err.message
        );
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

    // Setup space session (generates spaceId and delegation header)
    await this.setupSpaceSession(this.session);

    // Ensure space exists on TinyCloud server (creates if needed) and create SpaceConnection
    if (this._spaceId && this._delegationHeader) {
      try {
        await this.ensureSpaceExists();
        await this.createSpaceConnection();
      } catch (error) {
        console.warn("[TinyCloud] Failed to ensure space exists:", error);
        // Don't throw - space creation can be retried later
      }
    }

    // Apply extension afterSignIn hooks AFTER space is ready
    await this.applyAfterSignInHooks(this.session);

    dispatchSDKEvent.success("Successfully signed in");

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
    address: string
  ): Promise<TCWEnsData> {
    return tcwResolveEns(this.connection.provider, address);
  }

  /**
   * Invalidates user's session.
   */
  public async signOut(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.signOut(this.session);
      }
    } catch (err) {
      // request to /tcw-logout went wrong
      debug.error(err);
      dispatchSDKEvent.error(
        "auth.signout_failed",
        "Failed to sign out",
        err.message
      );
      throw err;
    }

    this.session = undefined;
    this.connection = undefined;
    this._spaceConnection = undefined;
    this._tinycloudSession = undefined;
    this._spaceId = undefined;
    this._delegationHeader = undefined;
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
   * @param partial - Optional partial SIWE message to override defaults
   * @returns SiweMessage object ready for signing
   */
  public async generateSiweMessage(
    address: string,
    partial?: PartialSiweMessage
  ): Promise<SiweMessage> {
    try {
      // Validate address format
      if (!address || !address.startsWith("0x") || address.length !== 42) {
        throw new Error(
          "Invalid Ethereum address format. Address must be a valid 0x-prefixed hex string."
        );
      }

      // Initialize TCWSessionManager from WASM
      let sessionManager: tcwSession.TCWSessionManager;
      try {
        sessionManager = await initialized.then(
          () => new tcwSession.TCWSessionManager()
        );
      } catch (error) {
        throw new Error(
          "Failed to initialize WASM session manager. Please try again."
        );
      }

      // Generate session key and store in manager
      let sessionKey: string;
      try {
        sessionKey = sessionManager.createSessionKey();
        if (!sessionKey) {
          throw new Error("Session key is empty or undefined");
        }
      } catch (error) {
        throw new Error("Failed to generate session key from WASM manager");
      }

      // Apply extension capabilities with address and chainId
      // chainId is hardcoded to 1 for this flow as per requirements
      const extensions = this.init.extensions;
      const chainId = 1;
      try {
        await this.applyExtensionCapabilities(sessionManager, extensions, address, chainId);
      } catch (error) {
        debug.warn("Extension capability application failed:", error);
        // Continue with session generation as extension capabilities are not critical
      }

      // Build SIWE message with defaults and ReCap capabilities
      const domain =
        partial?.domain ||
        (typeof window !== "undefined" ? window.location.host : "localhost");
      const nonce = partial?.nonce || generateNonce();
      const issuedAt = new Date().toISOString();

      // Build SIWE config for WASM session manager
      const siweConfig = {
        address,
        chainId: 1, // hardcoded as per requirements
        domain,
        nonce,
        issuedAt,
        expirationTime: partial?.expirationTime,
        notBefore: partial?.notBefore,
        statement: partial?.statement,
        requestId: partial?.requestId,
        resources: partial?.resources,
      };

      // Get the JWK before calling build() since build() consumes the sessionManager
      const jwk = sessionManager.jwk();
      if (jwk === undefined) {
        throw new Error("Failed to get JWK from session manager");
      }

      // Use sessionManager.build() to create SIWE with ReCap capabilities
      // This includes all the actions added via addTargetedActions
      // NOTE: build() consumes the sessionManager, so we stored the JWK above
      let siweString: string;
      try {
        siweString = sessionManager.build(siweConfig as any);
      } catch (error) {
        debug.error("Failed to build SIWE message with capabilities:", error);
        throw new Error("Failed to build SIWE message with ReCap capabilities");
      }

      // Store session state for later retrieval
      // Note: sessionManager is consumed by build(), so we store the JWK directly
      this.pendingSession = {
        sessionManager: null as any, // consumed by build()
        sessionKey: jwk, // store JWK directly
        address,
        generatedAt: Date.now(),
        extensions,
      };

      // Parse the SIWE string back into a SiweMessage object
      return new SiweMessage(siweString);
    } catch (error) {
      // Clean up any partial state on error
      this.pendingSession = undefined;

      debug.error("Failed to generate SIWE message:", error);
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
      throw new Error(
        "generateSiweMessage() must be called before signInWithSignature()"
      );
    }

    try {
      // Retrieve stored session key (stored during generateSiweMessage)
      const sessionKey = this.pendingSession.sessionKey;
      if (sessionKey === undefined) {
        throw new Error("unable to retrieve session key from pending session");
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

      // Set session to completed session
      this.session = session;

      // Clean up pendingSession after successful initialization
      this.pendingSession = undefined;

      // Setup space session (generates spaceId and delegation header)
      await this.setupSpaceSession(session);

      // Ensure space exists on TinyCloud server (creates if needed) and create SpaceConnection
      // This must happen BEFORE extension hooks so extensions can use the space
      if (this._spaceId && this._delegationHeader) {
        try {
          await this.ensureSpaceExists();
          await this.createSpaceConnection();
        } catch (error) {
          debug.warn("Failed to ensure space exists:", error);
          // Don't throw - space creation can be retried later
        }
      }

      // Apply extension afterSignIn hooks AFTER space is ready
      await this.applyAfterSignInHooks(session);

      // Return the session object
      return session;
    } catch (error) {
      // Clean up pendingSession on error
      this.pendingSession = undefined;
      throw error;
    }
  }

  /**
   * Default KV actions for TinyCloud services.
   * These are added to every session to enable basic KV operations.
   */
  private static readonly DEFAULT_KV_ACTIONS = [
    "tinycloud.kv/put",
    "tinycloud.kv/get",
    "tinycloud.kv/list",
    "tinycloud.kv/del",
    "tinycloud.kv/metadata",
  ];

  /**
   * Default capabilities actions (for reading user capabilities).
   */
  private static readonly DEFAULT_CAPABILITIES_ACTIONS = [
    "tinycloud.capabilities/read",
  ];

  /**
   * Applies extension capabilities (defaultActions/targetedActions) to the session manager.
   * This method also adds default KV and capabilities actions.
   *
   * @private
   * @param sessionManager - TCWSessionManager instance to apply capabilities to
   * @param extensions - Array of extensions to apply
   * @param address - User's Ethereum address (for building target URIs)
   * @param chainId - Chain ID (for building target URIs)
   * @param prefix - Space prefix (default: "default")
   */
  private async applyExtensionCapabilities(
    sessionManager: tcwSession.TCWSessionManager,
    extensions: TCWExtension[],
    address: string,
    chainId: number,
    prefix: string = "default"
  ): Promise<void> {
    // Build resource URI base in the format expected by ReCap:
    // tinycloud:pkh:eip155:{chainId}:{address}:{prefix}/{service}/{path}
    const spaceBase = `tinycloud:pkh:eip155:${chainId}:${address}:${prefix}`;

    // Add KV capabilities for default path
    const kvTarget = `${spaceBase}/kv/default/`;
    sessionManager.addTargetedActions(kvTarget, UserAuthorization.DEFAULT_KV_ACTIONS);

    // Add capabilities access
    const capabilitiesTarget = `${spaceBase}/capabilities/all/`;
    sessionManager.addTargetedActions(capabilitiesTarget, UserAuthorization.DEFAULT_CAPABILITIES_ACTIONS);

    // Apply extension capabilities
    for (const extension of extensions) {
      // Apply targeted actions if available
      if (extension.targetedActions) {
        try {
          const targetedActions = await extension.targetedActions();
          for (const target in targetedActions) {
            sessionManager.addTargetedActions(target, targetedActions[target]);
          }
        } catch (error) {
          debug.warn(
            `Failed to apply targeted actions for ${extension.namespace || "unknown TinyCloud extension"
            }:`,
            error
          );
          // Continue processing other extensions rather than failing completely
        }
      }
    }
  }

  /**
   * Get the space ID for the current session.
   * @returns Space ID or undefined if not available
   */
  public getSpaceId(): string | undefined {
    return this._spaceId;
  }

  /**
   * Get the configured TinyCloud host URLs.
   * @returns Array of TinyCloud host URLs
   */
  public getTinycloudHosts(): string[] {
    return this.tinycloudHosts;
  }

  /**
   * Get the active space connection.
   * This provides access to the user's TinyCloud space for storage operations.
   * @returns SpaceConnection instance
   * @throws Error if not signed in or space connection not established
   */
  public get spaceConnection(): SpaceConnection {
    if (!this._spaceConnection) {
      throw new Error("SpaceConnection not available. Please sign in first.");
    }
    return this._spaceConnection;
  }

  /**
   * Get the active TinyCloud session.
   * This provides access to the session for authenticated requests.
   * @returns Session object or undefined if not signed in
   */
  public getTinycloudSession(): Session | undefined {
    return this._tinycloudSession;
  }

  /** The host where the user's space was found or created */
  private _activeHost?: string;

  /**
   * Creates the SpaceConnection after the TinyCloud session is established.
   * This should be called after setupSpaceSession() and ensureSpaceExists().
   * @private
   */
  private async createSpaceConnection(): Promise<void> {
    if (!this._tinycloudSession) {
      debug.warn("Cannot create SpaceConnection: no TinyCloud session available");
      return;
    }
    if (!this._activeHost) {
      debug.warn("Cannot create SpaceConnection: no active host found for the space");
      return;
    }

    const authn = new Authenticator(this._tinycloudSession);
    this._spaceConnection = new SpaceConnection(this._activeHost, authn);
  }

  /**
   * Create the space on the TinyCloud server (host delegation).
   * This registers the user as the owner of the space.
   * Uses a modal to confirm with the user before creating.
   * @param host - The host to create the space on
   * @returns Promise resolving to true if space was created, false if user dismissed
   */
  private async hostSpace(host: string): Promise<boolean> {
    if (!this.session || !this._spaceId) {
      throw new Error("Must be signed in to host space");
    }

    const spaceId = this._spaceId;
    const address = this.session.address;
    const chainId = this.session.chainId;
    const domain = this.config.siweConfig?.domain || globalThis.location?.hostname || "localhost";

    // Show modal to get user confirmation
    const result = await showSpaceCreationModal({
      onCreateSpace: async () => {
        // Get peer ID from TinyCloud server
        const peerId = await fetchPeerId(host, spaceId);

        // Generate host SIWE message
        const siwe = generateHostSIWEMessage({
          address,
          chainId,
          domain,
          issuedAt: new Date().toISOString(),
          spaceId,
          peerId,
        });

        // Sign the message
        const signature = await this.signMessage(siwe);

        // Convert to delegation headers and submit
        const headers = siweToDelegationHeaders({ siwe, signature });
        const submitResult = await submitHostDelegation(host, headers);

        if (!submitResult.success) {
          dispatchSDKEvent.error(
            "storage.space_creation_failed",
            "Failed to create your TinyCloud Space",
            submitResult.error
          );
          throw new Error(`Failed to create space: ${submitResult.error}`);
        }

        dispatchSDKEvent.success("TinyCloud Space created successfully");
      },
      onDismiss: () => { },
    });

    return result.success;
  }

  /**
   * Ensure the user's space exists on the TinyCloud server.
   * Creates the space if it doesn't exist and autoCreateSpace is enabled.
   *
   * Strategy:
   * 1. Iterate through all `tinycloudHosts` and try to activate the session.
   * 2. If activation succeeds on any host, set it as the `_activeHost` and return.
   * 3. If activation fails with 404 on all hosts, it means the space doesn't exist.
   * 4. If `autoCreateSpace` is true, create the space on the primary host.
   * 5. After creation, attempt to activate the session again on the primary host.
   *
   * @throws Error if space creation fails or is disabled and space doesn't exist.
   */
  public async ensureSpaceExists(): Promise<void> {
    if (!this.session || !this._spaceId || !this._delegationHeader) {
      throw new Error("Must be signed in to ensure space exists");
    }

    // 1. Try to find the space on any of the configured hosts
    for (const host of this.tinycloudHosts.filter(h => h && h.length > 0)) {
      const result = await activateSessionWithHost(host, this._delegationHeader);
      if (result.success) {
        this._activeHost = host; // Found the space
        debug.log(`Space found on host: ${host}`);
        return;
      }

      if (result.status !== 404) {
        throw new Error(`Failed to activate session on ${host}: ${result.status} - ${result.error}`);
      }
    }

    // 3. If we're here, all hosts returned 404. The space doesn't exist.
    if (!this.autoCreateSpace) {
      debug.warn(`Space does not exist and autoCreateSpace is false. Cannot connect to space.`);
      return;
    }

    // 4. Determine host for creation.
    let hostForCreation: string | undefined;

    // Check if a node is set in the registry
    const registry = new Registry({ provider: this.provider });
    const node = await registry.addressNode();

    if (node) {
      hostForCreation = node;
    } else {
      // If no registry node, prompt user to select one.
      debug.log("No registry node found, prompting user for node selection.");
      const selection = await showNodeSelectionModal({
        onCreateNode: async (selectedHost: string) => {
          // No-op, logic is handled after modal closes
        },
        onDismiss: () => {
          debug.log("User dismissed node selection modal.");
        },
      });

      if (selection.dismissed || !selection.host) {
        debug.log("Space creation aborted due to node selection dismissal.");
        return;
      }
      hostForCreation = selection.host;
    }
    
    if (!hostForCreation) {
        debug.error("No valid host for space creation.");
        dispatchSDKEvent.error(
            "storage.space_creation_failed",
            "Could not determine a host to create your TinyCloud Space on."
        );
        return;
    }

    // Now, proceed with hostSpace using hostForCreation
    debug.log(`Space not found. Attempting to create on host: ${hostForCreation}`);
    const created = await this.hostSpace(hostForCreation);

    if (!created) {
      // User dismissed the space creation modal.
      debug.log("User dismissed space creation modal. Space connection not established.");
      return;
    }

    // 5. Space created, now try activation again on the creation host.
    const finalResult = await activateSessionWithHost(hostForCreation, this._delegationHeader);

    if (finalResult.success) {
      this._activeHost = hostForCreation; // Set active host after creation
      debug.log(`Space created and activated on host: ${hostForCreation}`);
      return;
    }

    // If it still fails, something is seriously wrong.
    throw new Error(
      `Failed to activate session on ${hostForCreation} even after creating the space: ` +
      `${finalResult.status} - ${finalResult.error}`
    );
  }

  /**
   * Apply extension afterSignIn hooks to the session.
   * @param session - The TCWClientSession object
   */
  private async applyAfterSignInHooks(
    session: TCWClientSession
  ): Promise<void> {
    const extensions = this.init.extensions;

    for (const extension of extensions) {
      if (extension.afterSignIn) {
        await extension.afterSignIn(session);
      }
    }
  }

  /**
   * Generate space ID and delegation header for the current session.
   * This sets up the internal state needed for ensureSpaceExists() and SpaceConnection.
   * @param session - The TCWClientSession object
   */
  private async setupSpaceSession(session: TCWClientSession): Promise<void> {
    try {
      // Ensure WASM modules are initialized
      await WasmInitializer.ensureInitialized();

      // Generate space ID
      this._spaceId = makeSpaceId(
        session.address,
        session.chainId,
        this.spacePrefix
      );

      // Parse SIWE message to get verification method
      const siweMessage = new SiweMessage(session.siwe);
      const verificationMethod = siweMessage.uri;

      if (!verificationMethod) {
        return;
      }

      // Generate delegation header using WASM
      const sessionData = {
        jwk: JSON.parse(session.sessionKey),
        spaceId: this._spaceId,
        service: "kv",
        siwe: session.siwe,
        signature: session.signature,
        verificationMethod,
      };

      const completedSession = completeSessionSetup(sessionData);
      if (completedSession?.delegationHeader) {
        this._delegationHeader = completedSession.delegationHeader;

        // Store the full TinyCloud session for SpaceConnection
        this._tinycloudSession = {
          delegationHeader: completedSession.delegationHeader,
          delegationCid: completedSession.delegationCid,
          jwk: JSON.parse(session.sessionKey),
          spaceId: this._spaceId,
          verificationMethod,
        };
      }
    } catch (error) {
      console.warn("[TinyCloud] Failed to setup space session:", error);
      // Don't throw - this is optional functionality
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
