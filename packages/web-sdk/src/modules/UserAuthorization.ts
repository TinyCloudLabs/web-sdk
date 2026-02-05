import { providers, Signer } from "ethers";
import { initialized, tcwSession, tinycloud } from "@tinycloudlabs/web-sdk-wasm";
import merge from "lodash.merge";
import { AxiosInstance } from "axios";
import { generateNonce, SiweMessage } from "siwe";
import { EnsData, resolveEns } from "@tinycloudlabs/web-core";
import type {
  ClientSession,
  ClientConfig,
  IConnected,
  Extension,
} from "@tinycloudlabs/web-core/client";
import {
  IUserAuthorization as ICoreUserAuthorization,
  SiweMessage as CoreSiweMessage,
  PartialSiweMessage,
  fetchPeerId,
  submitHostDelegation,
  activateSessionWithHost,
  checkNodeVersion,
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
import { Session } from "./Storage/tinycloud";

import Registry from "./registry/Registry";
import { multiaddrToUri } from "../utils/multiaddr";

/**
 * Extended Client Config with TinyCloud options
 */
declare module "@tinycloudlabs/web-core/client" {
  interface ClientConfig {
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
  /** Instance of SessionManager (null if consumed by build()) */
  sessionManager: tcwSession.TCWSessionManager | null;
  /** Session key JWK string (stored before build() consumes sessionManager) */
  sessionKey?: string;
  /** Ethereum address for the session */
  address: string;
  /** Timestamp when session was generated */
  generatedAt: number;
  /** Extensions that were applied to the session */
  extensions: Extension[];
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
  session?: ClientSession;

  /* createUserAuthorization */
  extend: (extension: Extension) => void;
  connect(): Promise<any>;
  signIn(): Promise<any>;
  /**
   * ENS data supported by the SDK.
   * @param address - User address.
   * @param resolveEnsOpts - Options to resolve ENS.
   * @returns Object containing ENS data.
   */
  resolveEns(
    /** User address */
    address: string
  ): Promise<EnsData>;
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
   * @returns Promise with the ClientSession object
   */
  signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<ClientSession>;
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
   * Get the active TinyCloud session.
   * This provides access to the session for authenticated requests.
   * @returns Session object or undefined if not signed in
   */
  getTinycloudSession(): Session | undefined;
}

class UserAuthorizationInit {
  /** Extensions for the session. */
  public extensions: Extension[] = [];

  /** The session representation (once signed in). */
  public session?: ClientSession;

  constructor(private config?: ClientConfig) { }

  /** Extend the session with a compatible extension. */
  extend(extension: Extension) {
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
      // WASM related error
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

/** An intermediate state: connected, but not signed-in. */
class UserAuthorizationConnected implements IConnected {
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
    /** Instance of SessionManager */
    public builder: tcwSession.TCWSessionManager,
    /** Config object. */
    public config: ClientConfig,
    /** Enabled extensions. */
    public extensions: Extension[],
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
   * @param spacePrefix - Space prefix (default: "default")
   * @param kvPrefix - KV path prefix for scoping access (default: "" for all paths)
   */
  public addDefaultCapabilities(
    address: string,
    chainId: number,
    spacePrefix: string = "default",
    kvPrefix: string = ""
  ): void {
    // Use makeSpaceId to ensure consistent spaceId format with setupSpaceSession
    // This is critical - the spaceId in capabilities must match the session spaceId
    const spaceId = makeSpaceId(address, chainId, spacePrefix);

    // Add KV capabilities for the configured path prefix
    // If kvPrefix is set (e.g., "demo-app"), access is scoped to that path
    // NOTE: No trailing slash - must match how KVService constructs invocation paths
    const kvTarget = kvPrefix ? `${spaceId}/kv/${kvPrefix}` : `${spaceId}/kv/`;
    this.builder.addTargetedActions(kvTarget, UserAuthorizationConnected.DEFAULT_KV_ACTIONS);

    // Add capabilities access
    const capabilitiesTarget = `${spaceId}/capabilities/all/`;
    this.builder.addTargetedActions(capabilitiesTarget, UserAuthorizationConnected.DEFAULT_CAPABILITIES_ACTIONS);
  }

  /**
   * Applies the "afterSignIn" methods of the extensions.
   * @param session - ClientSession object.
   */
  public async afterSignIn(session: ClientSession): Promise<void> {
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
   * @returns Promise with the ClientSession object.
   */
  async signIn(): Promise<ClientSession> {
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
    const spacePrefix = (this.config as any)?.spacePrefix ?? "default";
    const kvPrefix = (this.config as any)?.kvPrefix ?? "";
    this.addDefaultCapabilities(address, chainId, spacePrefix, kvPrefix);

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
   * @param session - ClientSession object.
   */
  async signOut(session: ClientSession): Promise<void> {
    // TODO: kill sessions
  }
}

const DEFAULT_CONFIG: ClientConfig = {
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
  public session?: ClientSession;

  /** Session builder. */
  private init: UserAuthorizationInit;

  /** Current connection */
  private connection?: UserAuthorizationConnected;

  /** The config object. */
  private config: ClientConfig;

  /** Pending session state for signature-based initialization */
  private pendingSession?: PendingSession;

  /** Whether to automatically create space if it doesn't exist */
  private autoCreateSpace: boolean;

  /** TinyCloud server endpoints */
  private tinycloudHosts: string[];

  /** Space prefix for new sessions */
  private spacePrefix: string;

  /** KV path prefix for scoping access */
  private kvPrefix: string;

  /** The space ID for the current session */
  private _spaceId?: string;

  /** Delegation header for the current session */
  private _delegationHeader?: { Authorization: string };

  /** The TinyCloud session containing delegation and space info */
  private _tinycloudSession?: Session;

  /** The host where the user's space was found or created */
  private _activeHost?: string;

  constructor(private _config: ClientConfig = DEFAULT_CONFIG) {
    this.config = _config;
    this.init = new UserAuthorizationInit({
      ...this.config,
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...this.config?.providers,
      },
    });

    // Initialize space-related options with defaults
    this.autoCreateSpace = (_config as any).autoCreateSpace ?? true;
    const configuredHosts = (_config as any).tinycloudHosts ?? [];
    this.tinycloudHosts = configuredHosts.length > 0
      ? [...configuredHosts]
      : ["https://node.tinycloud.xyz", "https://tee.tinycloud.xyz"];
    this.spacePrefix = (_config as any).spacePrefix ?? "default";
    this.kvPrefix = (_config as any).kvPrefix ?? "";
  }

  /**
   * Extends with functions that are called after connecting and signing in.
   */
  public extend(extension: Extension): void {
    this.init.extend(extension);
  }

  public async connect(): Promise<void> {
    if (this.connection) {
      return;
    }
    try {
      this.connection = await this.init.connect();
      this.provider = this.connection.provider;

      // Try to get node from registry and prepend it to hosts list
      try {
        const registry = new Registry({
          provider: this.provider
        });
        const address = await this.provider.getSigner().getAddress();
        const chainId = await this.provider.getNetwork().then((network) => network.chainId);
        const node = await registry.addressNode()
        if (node && !this.tinycloudHosts.includes(node)) {
          // Append registry node after configured hosts
          this.tinycloudHosts.push(node);
          debug.log(`Added registry node to hosts: ${node}`);
        }
      } catch (error) {
        debug.warn("Failed to get node from registry:", error);
        // Continue without registry node - not a critical failure
      }
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

  public async signIn(): Promise<ClientSession> {
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

    // Verify SDK-node protocol compatibility
    await checkNodeVersion(this.tinycloudHosts[0], tinycloud.protocolVersion());

    // Ensure space exists on TinyCloud server (creates if needed)
    if (this._spaceId && this._delegationHeader) {
      try {
        await this.ensureSpaceExists();
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
   * ENS data supported by the SDK.
   * @param address - User address.
   * @param resolveEnsOpts - Options to resolve ENS.
   * @returns Object containing ENS data.
   */
  public async resolveEns(
    /** User address */
    address: string
  ): Promise<EnsData> {
    return resolveEns(this.connection.provider, address);
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
      // request to logout went wrong
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
    this._tinycloudSession = undefined;
    this._spaceId = undefined;
    this._delegationHeader = undefined;
    this._activeHost = undefined;
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
   * This method initializes a SessionManager, generates a session key,
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

      // Initialize SessionManager from WASM
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
        await this.applyExtensionCapabilities(sessionManager, extensions, address, chainId, this.spacePrefix, this.kvPrefix);
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
   * @returns Promise with the ClientSession object
   */
  public async signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<ClientSession> {
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

      // Create ClientSession object
      const session: ClientSession = {
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

      // Verify SDK-node protocol compatibility
      await checkNodeVersion(this.tinycloudHosts[0], tinycloud.protocolVersion());

      // Ensure space exists on TinyCloud server (creates if needed)
      // This must happen BEFORE extension hooks so extensions can use the space
      if (this._spaceId && this._delegationHeader) {
        try {
          await this.ensureSpaceExists();
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
   * @param sessionManager - SessionManager instance to apply capabilities to
   * @param extensions - Array of extensions to apply
   * @param address - User's Ethereum address (for building target URIs)
   * @param chainId - Chain ID (for building target URIs)
   * @param spacePrefix - Space prefix (default: "default")
   * @param kvPrefix - KV path prefix for scoping access (default: "" for all paths)
   */
  private async applyExtensionCapabilities(
    sessionManager: tcwSession.TCWSessionManager,
    extensions: Extension[],
    address: string,
    chainId: number,
    spacePrefix: string = "default",
    kvPrefix: string = ""
  ): Promise<void> {
    // Build resource URI base in the format expected by ReCap:
    // tinycloud:pkh:eip155:{chainId}:{address}:{prefix}/{service}/{path}
    const spaceBase = `tinycloud:pkh:eip155:${chainId}:${address}:${spacePrefix}`;

    // Add KV capabilities for the configured path prefix
    // If kvPrefix is set (e.g., "demo-app"), access is scoped to that path
    // NOTE: No trailing slash - must match how KVService constructs invocation paths
    const kvTarget = kvPrefix ? `${spaceBase}/kv/${kvPrefix}` : `${spaceBase}/kv/`;
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
   * Get the active TinyCloud session.
   * This provides access to the session for authenticated requests.
   * @returns Session object or undefined if not signed in
   */
  public getTinycloudSession(): Session | undefined {
    return this._tinycloudSession;
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
    try {
      const result = await showSpaceCreationModal({

        onCreateSpace: async () => {
          try {
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
            return;
          } catch (error) {
            debug.error("Space creation error:", error);
            throw error;
          }
        },
        onDismiss: () => {
          debug.log("User dismissed space creation modal");
        },
      });

      return result.success;
    } catch (error) {
      debug.error("Space creation modal error:", error);
      return false;
    }
  }

  /**
   * Ensure the user's space exists on the TinyCloud server.
   * Creates the space if it doesn't exist and autoCreateSpace is enabled.
   *
   * Strategy:
   * 1. Try to activate the session on the first (primary) host.
   * 2. If activation succeeds, set it as the `_activeHost` and return.
   * 3. If the primary host returns 404, create the space there (don't skip
   *    because it might exist on other hosts - there is no replication).
   * 4. If the primary host has a non-404 error, try remaining hosts.
   *
   * @throws Error if space creation fails or is disabled and space doesn't exist.
   */
  public async ensureSpaceExists(): Promise<void> {
    if (!this.session || !this._spaceId || !this._delegationHeader) {
      throw new Error("Must be signed in to ensure space exists");
    }

    const primaryHost = this.tinycloudHosts[0];

    // 1. Try the primary (first configured) host
    try {
      const result = await activateSessionWithHost(primaryHost, this._delegationHeader);
      if (result.success) {
        this._activeHost = primaryHost;
        debug.log(`Space found on primary host: ${primaryHost}`);
        return;
      }

      // Primary host returned 404 - space doesn't exist there, create it
      if (result.status === 404) {
        if (!this.autoCreateSpace) {
          debug.warn(`Space does not exist on ${primaryHost} and autoCreateSpace is false.`);
          return;
        }

        await this.createSpaceOnHost(primaryHost);
        return;
      }

      // Non-404 error on primary host - log and try remaining hosts
      debug.warn(`Failed to activate session on ${primaryHost}: ${result.status} - ${result.error}`);
    } catch (error) {
      debug.warn(`Error trying to activate session on ${primaryHost}:`, error);
    }

    // 2. Primary host had a non-404 error. Try remaining hosts.
    for (let i = 1; i < this.tinycloudHosts.length; i++) {
      const host = this.tinycloudHosts[i];
      try {
        const result = await activateSessionWithHost(host, this._delegationHeader);
        if (result.success) {
          this._activeHost = host;
          debug.log(`Space found on host: ${host}`);
          return;
        }

        if (result.status === 404) {
          // Space doesn't exist on this fallback host either - skip, don't create
          continue;
        }

        debug.warn(`Failed to activate session on ${host}: ${result.status} - ${result.error}`);
      } catch (error) {
        debug.warn(`Error trying to activate session on ${host}:`, error);
      }
    }

    // 3. No host had the space and primary had a non-404 error.
    // Try to create on primary host anyway if autoCreateSpace is enabled.
    if (!this.autoCreateSpace) {
      debug.warn(`Space does not exist and autoCreateSpace is false.`);
      return;
    }

    await this.createSpaceOnHost(primaryHost);
  }

  /**
   * Create the space on a specific host and activate the session there.
   */
  private async createSpaceOnHost(host: string): Promise<void> {
    debug.log(`Space not found on ${host}. Attempting to create.`);

    try {
      const created = await this.hostSpace(host);

      if (!created) {
        debug.log("User dismissed space creation modal.");
        return;
      }

      // Space created, now try activation again
      const finalResult = await activateSessionWithHost(host, this._delegationHeader);

      if (finalResult.success) {
        this._activeHost = host;
        debug.log(`Space created and activated on host: ${host}`);
        return;
      }

      throw new Error(
        `Failed to activate session on ${host} even after creating the space: ` +
        `${finalResult.status} - ${finalResult.error}`
      );
    } catch (error) {
      debug.error("Failed to create space:", error);
      dispatchSDKEvent.error(
        "storage.space_creation_failed",
        "Failed to create your TinyCloud Space",
        error.message
      );
      throw error;
    }
  }

  /**
   * Apply extension afterSignIn hooks to the session.
   * @param session - The ClientSession object
   */
  private async applyAfterSignInHooks(
    session: ClientSession
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
   * @param session - The ClientSession object
   */
  private async setupSpaceSession(session: ClientSession): Promise<void> {
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

        // Store the full TinyCloud session
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
