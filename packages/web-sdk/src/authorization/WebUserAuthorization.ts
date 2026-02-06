/**
 * WebUserAuthorization - Browser-based authorization following node-sdk architecture.
 *
 * This class implements IUserAuthorization for browser environments with:
 * - Session-only mode (no wallet required)
 * - SignStrategy patterns (wallet popup as default, callback, event-emitter)
 * - did vs sessionDid model
 * - connectWallet() upgrade pattern
 *
 * @packageDocumentation
 */

import { providers, Signer } from "ethers";
import { initialized, tcwSession, tinycloud } from "@tinycloud/web-sdk-wasm";
import {
  IUserAuthorization,
  ISigner,
  ISessionStorage,
  ClientSession,
  Extension,
  PersistedSessionData,
  TinyCloudSession,
  SignStrategy,
  SignRequest,
  SignResponse,
  ISpaceCreationHandler,
  SpaceCreationContext,
  defaultSignStrategy,
  defaultSpaceCreationHandler,
  fetchPeerId,
  submitHostDelegation,
  activateSessionWithHost,
  checkNodeVersion,
  JWK,
} from "@tinycloud/sdk-core";
import { dispatchSDKEvent } from "../notifications/ErrorHandler";
import { WasmInitializer } from "../modules/WasmInitializer";
import { debug } from "../utils/debug";
import {
  generateHostSIWEMessage,
  siweToDelegationHeaders,
  makeSpaceId,
  completeSessionSetup,
  prepareSession,
} from "../modules/Storage/tinycloud/module";
import { Session } from "../modules/Storage/tinycloud";

/**
 * Web3 provider signer adapter.
 * Wraps an ethers Web3Provider signer to implement ISigner.
 */
class Web3ProviderSigner implements ISigner {
  constructor(private signer: Signer) {}

  async getAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  async getChainId(): Promise<number> {
    return this.signer.getChainId();
  }

  async signMessage(message: string): Promise<string> {
    return this.signer.signMessage(message);
  }
}

/**
 * Wallet popup sign strategy for web.
 * Shows browser wallet popup for each sign request.
 */
export interface WalletPopupStrategy {
  type: "wallet-popup";
}

/**
 * Web-specific SignStrategy that includes wallet-popup.
 */
export type WebSignStrategy =
  | SignStrategy
  | WalletPopupStrategy;

/**
 * Default web sign strategy is wallet-popup.
 */
export const defaultWebSignStrategy: WebSignStrategy = { type: "wallet-popup" };

/**
 * Configuration for WebUserAuthorization.
 */
export interface WebUserAuthorizationConfig {
  /** Web3 provider (e.g., window.ethereum or WalletConnect) */
  provider?: providers.ExternalProvider | providers.Web3Provider;
  /** Sign strategy for handling sign requests (default: wallet-popup) */
  signStrategy?: WebSignStrategy;
  /** Session storage implementation */
  sessionStorage?: ISessionStorage;
  /** Handler for space creation confirmation */
  spaceCreationHandler?: ISpaceCreationHandler;
  /** Domain for SIWE messages (default: window.location.hostname) */
  domain?: string;
  /** URI for SIWE messages */
  uri?: string;
  /** Statement included in SIWE messages */
  statement?: string;
  /** Space prefix for new sessions (default: "default") */
  spacePrefix?: string;
  /** Default actions for sessions */
  defaultActions?: Record<string, Record<string, string[]>>;
  /** Session expiration time in milliseconds (default: 1 hour) */
  sessionExpirationMs?: number;
  /** Automatically create space if it doesn't exist (default: true) */
  autoCreateSpace?: boolean;
  /** TinyCloud server endpoints (default: ["https://node.tinycloud.xyz"]) */
  tinycloudHosts?: string[];
}

/**
 * Browser-based implementation of IUserAuthorization.
 *
 * Supports multiple modes:
 * - **Session-only mode**: Can receive delegations without wallet
 * - **Wallet mode**: Full sign-in with space ownership
 *
 * Supports multiple sign strategies:
 * - **wallet-popup**: Show browser wallet popup (default for web)
 * - **auto-sign**: Automatically approve (requires ISigner)
 * - **callback**: Delegate to custom callback
 * - **event-emitter**: Emit events for async approval
 *
 * @example
 * ```typescript
 * // Standard wallet popup flow
 * const auth = new WebUserAuthorization({
 *   provider: window.ethereum,
 *   domain: 'myapp.com',
 * });
 * await auth.signIn();
 *
 * // Session-only mode (no wallet required)
 * const auth = new WebUserAuthorization();
 * console.log(auth.sessionDid); // Available immediately
 * // Later: auth.connectWallet(window.ethereum);
 *
 * // Callback strategy for custom approval
 * const auth = new WebUserAuthorization({
 *   provider: window.ethereum,
 *   signStrategy: {
 *     type: 'callback',
 *     handler: async (req) => {
 *       const approved = await showCustomModal(`Sign for ${req.address}?`);
 *       return { approved };
 *     }
 *   },
 *   domain: 'myapp.com',
 * });
 * ```
 */
export class WebUserAuthorization implements IUserAuthorization {
  /** Flag to ensure WASM initialization is tracked */
  private static wasmInitialized = false;

  // Configuration
  private readonly signStrategy: WebSignStrategy;
  private readonly sessionStorage?: ISessionStorage;
  private readonly spaceCreationHandler: ISpaceCreationHandler;
  private readonly domain: string;
  private readonly uri: string;
  private readonly statement?: string;
  private readonly spacePrefix: string;
  private readonly defaultActions: Record<string, Record<string, string[]>>;
  private readonly sessionExpirationMs: number;
  private readonly autoCreateSpace: boolean;
  private readonly tinycloudHosts: string[];

  // Wallet/Provider state (nullable for session-only mode)
  private _provider?: providers.Web3Provider;
  private _signer?: ISigner;

  // Session management
  private sessionManager: tcwSession.TCWSessionManager;
  private sessionKeyId: string;
  private extensions: Extension[] = [];
  private _session?: ClientSession;
  private _tinyCloudSession?: TinyCloudSession;
  private _address?: string;
  private _chainId?: number;

  constructor(config: WebUserAuthorizationConfig = {}) {
    // Set up configuration with defaults
    this.signStrategy = config.signStrategy ?? defaultWebSignStrategy;
    this.sessionStorage = config.sessionStorage;
    this.spaceCreationHandler = config.spaceCreationHandler ?? defaultSpaceCreationHandler;
    this.domain = config.domain ?? (typeof window !== "undefined" ? window.location.hostname : "localhost");
    this.uri = config.uri ?? (typeof window !== "undefined" ? window.location.origin : `https://${this.domain}`);
    this.statement = config.statement;
    this.spacePrefix = config.spacePrefix ?? "default";
    this.defaultActions = config.defaultActions ?? {
      kv: {
        "": [
          "tinycloud.kv/put",
          "tinycloud.kv/get",
          "tinycloud.kv/del",
          "tinycloud.kv/list",
          "tinycloud.kv/metadata",
        ],
      },
      capabilities: {
        "": ["tinycloud.capabilities/read"],
      },
    };
    this.sessionExpirationMs = config.sessionExpirationMs ?? 60 * 60 * 1000;
    this.autoCreateSpace = config.autoCreateSpace ?? true;
    this.tinycloudHosts = config.tinycloudHosts ?? ["https://node.tinycloud.xyz"];

    // Set up provider/signer if provided
    if (config.provider) {
      this.setProvider(config.provider);
    }

    // Initialize session manager (constructor auto-creates "default" key in Rust)
    this.sessionManager = new tcwSession.TCWSessionManager();
    // Don't call createSessionKey - the Rust constructor already creates "default" key
    this.sessionKeyId = "default";
  }

  /**
   * Set or update the provider.
   */
  private setProvider(provider: providers.ExternalProvider | providers.Web3Provider): void {
    // Check if it's already a Web3Provider by checking for the _isProvider property
    // eslint-disable-next-line no-underscore-dangle
    if ((provider as providers.Web3Provider)._isProvider) {
      this._provider = provider as providers.Web3Provider;
    } else {
      // It's an ExternalProvider (like window.ethereum)
      this._provider = new providers.Web3Provider(provider as providers.ExternalProvider);
    }
    this._signer = new Web3ProviderSigner(this._provider.getSigner());
  }

  // =========================================================================
  // Session-Only Mode (did vs sessionDid model)
  // =========================================================================

  /**
   * Whether this instance is in session-only mode (no wallet connected).
   */
  get isSessionOnly(): boolean {
    return this._provider === undefined;
  }

  /**
   * Get the appropriate DID for this user.
   *
   * - If wallet connected and signed in: returns PKH DID (persistent identity)
   * - If session-only mode: returns session key DID (ephemeral)
   *
   * Use this for delegations and identity operations.
   */
  get did(): string {
    // If we have a wallet address and are signed in, return PKH DID
    if (this._address && this._chainId && this._session) {
      return `did:pkh:eip155:${this._chainId}:${this._address}`;
    }
    // Otherwise return session key DID
    return this.sessionDid;
  }

  /**
   * Get the session key DID (always available).
   *
   * Format: `did:key:z6Mk...#z6Mk...`
   */
  get sessionDid(): string {
    return this.sessionManager.getDID(this.sessionKeyId);
  }

  /**
   * Get the session key JWK (always available).
   *
   * This is used for session-only mode operations like useDelegation()
   * where we need the session key to create a session from a received delegation.
   *
   * @returns The JWK for the current session key
   * @throws Error if session key not found
   */
  getSessionKeyJwk(): JWK {
    const jwkString = this.sessionManager.jwk(this.sessionKeyId);
    if (!jwkString) {
      throw new Error("Session key JWK not found");
    }
    return JSON.parse(jwkString);
  }

  // =========================================================================
  // Connect Wallet Upgrade Pattern
  // =========================================================================

  /**
   * Connect a wallet to upgrade from session-only mode.
   *
   * This allows users who started in session-only mode (e.g., received
   * delegations) to later connect a wallet and create their own space.
   *
   * @param provider - Web3 provider (e.g., window.ethereum)
   * @param options - Optional configuration
   *
   * @example
   * ```typescript
   * // Start in session-only mode
   * const auth = new WebUserAuthorization();
   * console.log(auth.isSessionOnly); // true
   * console.log(auth.did); // did:key:z6Mk... (session key DID)
   *
   * // User clicks "Connect Wallet"
   * auth.connectWallet(window.ethereum);
   * console.log(auth.isSessionOnly); // false
   *
   * // Now can sign in to create own space
   * await auth.signIn();
   * console.log(auth.did); // did:pkh:eip155:1:0x... (wallet DID)
   * ```
   */
  connectWallet(
    provider: providers.ExternalProvider | providers.Web3Provider,
    options?: { spacePrefix?: string }
  ): void {
    if (this._provider) {
      throw new Error("Wallet already connected. Call signOut() first to reconnect.");
    }

    this.setProvider(provider);

    // Update space prefix if provided
    if (options?.spacePrefix) {
      (this as any).spacePrefix = options.spacePrefix;
    }
  }

  /**
   * Check if a wallet is connected (but may not be signed in).
   */
  get isWalletConnected(): boolean {
    return this._provider !== undefined;
  }

  // =========================================================================
  // IUserAuthorization Implementation
  // =========================================================================

  /**
   * The current active session (web-core compatible).
   */
  get session(): ClientSession | undefined {
    return this._session;
  }

  /**
   * The current TinyCloud session with full delegation data.
   */
  get tinyCloudSession(): TinyCloudSession | undefined {
    return this._tinyCloudSession;
  }

  /**
   * Add an extension to the authorization flow.
   */
  extend(extension: Extension): void {
    this.extensions.push(extension);
  }

  /**
   * Get the space ID for the current session.
   */
  getSpaceId(): string | undefined {
    return this._tinyCloudSession?.spaceId;
  }

  /**
   * Get the TinyCloud session.
   */
  getTinycloudSession(): Session | undefined {
    if (!this._tinyCloudSession) return undefined;
    return {
      delegationHeader: this._tinyCloudSession.delegationHeader,
      delegationCid: this._tinyCloudSession.delegationCid,
      jwk: this._tinyCloudSession.jwk,
      spaceId: this._tinyCloudSession.spaceId,
      verificationMethod: this._tinyCloudSession.verificationMethod,
    };
  }

  /**
   * Get the configured TinyCloud hosts.
   */
  getTinycloudHosts(): string[] {
    return this.tinycloudHosts;
  }

  /**
   * Sign in and create a new session.
   *
   * @throws Error if in session-only mode (no wallet connected)
   */
  async signIn(): Promise<ClientSession> {
    if (!this._provider || !this._signer) {
      throw new Error(
        "No wallet connected. Call connectWallet() first or provide a provider in config."
      );
    }

    // Ensure WASM is initialized
    await WasmInitializer.ensureInitialized();

    // Get signer address and chain ID
    this._address = await this._signer.getAddress();
    this._chainId = await this._signer.getChainId();

    // Ensure EIP-55 checksum address
    const address = tinycloud.ensureEip55(this._address);
    const chainId = this._chainId;

    // Create a session key with timestamp
    const keyId = `session-${Date.now()}`;
    this.sessionManager.renameSessionKeyId(this.sessionKeyId, keyId);
    this.sessionKeyId = keyId;

    // Get JWK for session key
    const jwkString = this.sessionManager.jwk(keyId);
    if (!jwkString) {
      throw new Error("Failed to create session key");
    }
    const jwk = JSON.parse(jwkString);

    // Create space ID
    const spaceId = makeSpaceId(address, chainId, this.spacePrefix);

    const now = new Date();
    const expirationTime = new Date(now.getTime() + this.sessionExpirationMs);

    // Prepare session - this creates the SIWE message with ReCap capabilities
    const prepared = prepareSession({
      abilities: this.defaultActions,
      address,
      chainId,
      domain: this.domain,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      spaceId,
      jwk,
    });

    // Sign the SIWE message using configured strategy
    const signature = await this.requestSignature({
      address,
      chainId,
      message: prepared.siwe,
      type: "siwe",
    });

    // Complete session setup with the prepared session + signature
    const session = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Create client session (web-core compatible)
    const clientSession: ClientSession = {
      address,
      walletAddress: address,
      chainId,
      sessionKey: keyId,
      siwe: prepared.siwe,
      signature,
    };

    // Create TinyCloud session with full delegation data
    const tinycloudSession: TinyCloudSession = {
      address,
      chainId,
      sessionKey: keyId,
      spaceId,
      delegationCid: session.delegationCid,
      delegationHeader: session.delegationHeader,
      verificationMethod: this.sessionManager.getDID(keyId),
      jwk,
      siwe: prepared.siwe,
      signature,
    };

    // Persist session if storage available
    if (this.sessionStorage) {
      const persistedData: PersistedSessionData = {
        address,
        chainId,
        sessionKey: JSON.stringify(jwk),
        siwe: prepared.siwe,
        signature,
        tinycloudSession: {
          delegationHeader: session.delegationHeader,
          delegationCid: session.delegationCid,
          spaceId,
          verificationMethod: this.sessionManager.getDID(keyId),
        },
        expiresAt: expirationTime.toISOString(),
        createdAt: now.toISOString(),
        version: "1.0",
      };
      await this.sessionStorage.save(address, persistedData);
    }

    // Set current session
    this._session = clientSession;
    this._tinyCloudSession = tinycloudSession;

    // Verify SDK-node protocol compatibility
    await checkNodeVersion(this.tinycloudHosts[0], tinycloud.protocolVersion());

    // Ensure space exists (creates if needed when autoCreateSpace is true)
    await this.ensureSpaceExists();

    // Call extension hooks AFTER space is ready
    for (const ext of this.extensions) {
      if (ext.afterSignIn) {
        await ext.afterSignIn(clientSession);
      }
    }

    dispatchSDKEvent.success("Successfully signed in");

    return clientSession;
  }

  /**
   * Sign out and clear the current session.
   */
  async signOut(): Promise<void> {
    if (this._address && this.sessionStorage) {
      await this.sessionStorage.clear(this._address);
    }

    this._session = undefined;
    this._tinyCloudSession = undefined;
    // Note: We don't clear _provider/_signer - user can sign in again
  }

  /**
   * Get the current wallet address.
   */
  address(): string | undefined {
    return this._address;
  }

  /**
   * Get the current chain ID.
   */
  chainId(): number | undefined {
    return this._chainId;
  }

  /**
   * Sign a message with the connected wallet.
   */
  async signMessage(message: string): Promise<string> {
    if (!this._signer) {
      throw new Error("No wallet connected");
    }

    if (!this._address) {
      this._address = await this._signer.getAddress();
    }
    if (!this._chainId) {
      this._chainId = await this._signer.getChainId();
    }

    return this.requestSignature({
      address: this._address,
      chainId: this._chainId,
      message,
      type: "message",
    });
  }

  // =========================================================================
  // External Signing Support (for hardware wallets, WalletConnect, etc.)
  // =========================================================================

  /**
   * Prepare a session for external signing.
   *
   * Use this when you need to sign the SIWE message externally (e.g., via
   * a hardware wallet or WalletConnect that handles signing separately).
   *
   * @example
   * ```typescript
   * const { prepared, keyId, jwk, address, chainId } = await auth.prepareSessionForSigning();
   * // Sign with external tool
   * const signature = await walletConnect.signMessage(prepared.siwe);
   * const session = await auth.signInWithPreparedSession(prepared, signature, keyId, jwk);
   * ```
   */
  async prepareSessionForSigning(): Promise<{
    prepared: {
      siwe: string;
      jwk: Record<string, unknown>;
      spaceId: string;
      verificationMethod: string;
    };
    keyId: string;
    jwk: Record<string, unknown>;
    address: string;
    chainId: number;
  }> {
    if (!this._signer) {
      throw new Error("No wallet connected");
    }

    await WasmInitializer.ensureInitialized();

    const address = tinycloud.ensureEip55(await this._signer.getAddress());
    const chainId = await this._signer.getChainId();

    // Create a session key
    const keyId = `session-${Date.now()}`;
    this.sessionManager.renameSessionKeyId(this.sessionKeyId, keyId);
    this.sessionKeyId = keyId;

    // Get JWK for session key
    const jwkString = this.sessionManager.jwk(keyId);
    if (!jwkString) {
      throw new Error("Failed to create session key");
    }
    const jwk = JSON.parse(jwkString);

    // Create space ID
    const spaceId = makeSpaceId(address, chainId, this.spacePrefix);

    const now = new Date();
    const expirationTime = new Date(now.getTime() + this.sessionExpirationMs);

    // Prepare session
    const prepared = prepareSession({
      abilities: this.defaultActions,
      address,
      chainId,
      domain: this.domain,
      issuedAt: now.toISOString(),
      expirationTime: expirationTime.toISOString(),
      spaceId,
      jwk,
    });

    return {
      prepared,
      keyId,
      jwk,
      address,
      chainId,
    };
  }

  /**
   * Complete sign-in with a prepared session and signature.
   */
  async signInWithPreparedSession(
    prepared: {
      siwe: string;
      jwk: Record<string, unknown>;
      spaceId: string;
      verificationMethod: string;
    },
    signature: string,
    keyId: string,
    jwk: Record<string, unknown>
  ): Promise<ClientSession> {
    if (!this._signer) {
      throw new Error("No wallet connected");
    }

    // Complete session setup
    const session = completeSessionSetup({
      ...prepared,
      signature,
    });

    const address = tinycloud.ensureEip55(await this._signer.getAddress());
    const chainId = await this._signer.getChainId();

    // Create client session
    const clientSession: ClientSession = {
      address,
      walletAddress: address,
      chainId,
      sessionKey: keyId,
      siwe: prepared.siwe,
      signature,
    };

    // Create TinyCloud session
    const tinycloudSession: TinyCloudSession = {
      address,
      chainId,
      sessionKey: keyId,
      spaceId: prepared.spaceId,
      delegationCid: session.delegationCid,
      delegationHeader: session.delegationHeader,
      verificationMethod: this.sessionManager.getDID(keyId),
      jwk,
      siwe: prepared.siwe,
      signature,
    };

    // Extract expiration from SIWE message
    const expirationMatch = prepared.siwe.match(/Expiration Time: (.+)/);
    const issuedAtMatch = prepared.siwe.match(/Issued At: (.+)/);
    const expiresAt = expirationMatch?.[1] ?? new Date(Date.now() + this.sessionExpirationMs).toISOString();
    const createdAt = issuedAtMatch?.[1] ?? new Date().toISOString();

    // Persist session if storage available
    if (this.sessionStorage) {
      const persistedData: PersistedSessionData = {
        address,
        chainId,
        sessionKey: JSON.stringify(jwk),
        siwe: prepared.siwe,
        signature,
        tinycloudSession: {
          delegationHeader: session.delegationHeader,
          delegationCid: session.delegationCid,
          spaceId: prepared.spaceId,
          verificationMethod: this.sessionManager.getDID(keyId),
        },
        expiresAt,
        createdAt,
        version: "1.0",
      };
      await this.sessionStorage.save(address, persistedData);
    }

    // Set current session
    this._session = clientSession;
    this._tinyCloudSession = tinycloudSession;
    this._address = address;
    this._chainId = chainId;

    // Verify SDK-node protocol compatibility
    await checkNodeVersion(this.tinycloudHosts[0], tinycloud.protocolVersion());

    // Ensure space exists
    await this.ensureSpaceExists();

    // Call extension hooks AFTER space is ready
    for (const ext of this.extensions) {
      if (ext.afterSignIn) {
        await ext.afterSignIn(clientSession);
      }
    }

    return clientSession;
  }

  // =========================================================================
  // Space Management
  // =========================================================================

  /**
   * Ensure the user's space exists on the TinyCloud server.
   */
  async ensureSpaceExists(): Promise<void> {
    if (!this._tinyCloudSession) {
      throw new Error("Must be signed in to ensure space exists");
    }

    const host = this.tinycloudHosts[0];

    // Try to activate the session
    const result = await activateSessionWithHost(
      host,
      this._tinyCloudSession.delegationHeader
    );

    if (result.success) {
      return;
    }

    if (result.status === 404) {
      // Space doesn't exist
      if (!this.autoCreateSpace) {
        // In web mode with autoCreateSpace disabled, silently return
        // (user may be accessing via delegations)
        return;
      }

      // Confirm with space creation handler
      const context: SpaceCreationContext = {
        spaceId: this._tinyCloudSession.spaceId,
        address: this._tinyCloudSession.address,
        chainId: this._tinyCloudSession.chainId,
        host,
      };

      const confirmed = await this.spaceCreationHandler.confirmSpaceCreation(context);
      if (!confirmed) {
        throw new Error(
          "Space creation was cancelled. Sign-in requires a space."
        );
      }

      // Create the space
      const created = await this.hostSpace();
      if (!created) {
        const error = new Error("Failed to create space");
        this.spaceCreationHandler.onSpaceCreationFailed?.(context, error);
        throw error;
      }

      // Notify handler of success
      this.spaceCreationHandler.onSpaceCreated?.(context);

      // Small delay for propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Retry activation
      const retryResult = await activateSessionWithHost(
        host,
        this._tinyCloudSession.delegationHeader
      );

      if (!retryResult.success) {
        throw new Error(`Failed to activate session after creating space: ${retryResult.error}`);
      }

      return;
    }

    throw new Error(`Failed to activate session: ${result.error}`);
  }

  /**
   * Create the space on the TinyCloud server.
   */
  private async hostSpace(): Promise<boolean> {
    if (!this._tinyCloudSession || !this._address || !this._chainId) {
      throw new Error("Must be signed in to host space");
    }

    const host = this.tinycloudHosts[0];
    const spaceId = this._tinyCloudSession.spaceId;

    // Get peer ID from TinyCloud server
    const peerId = await fetchPeerId(host, spaceId);

    // Generate host SIWE message
    const siwe = generateHostSIWEMessage({
      address: this._address,
      chainId: this._chainId,
      domain: this.domain,
      issuedAt: new Date().toISOString(),
      spaceId,
      peerId,
    });

    // Sign the message
    const signature = await this.signMessage(siwe);

    // Convert to delegation headers and submit
    const headers = siweToDelegationHeaders({ siwe, signature });
    const result = await submitHostDelegation(host, headers);

    return result.success;
  }

  // =========================================================================
  // Sign Strategy Implementation
  // =========================================================================

  /**
   * Request a signature using the configured strategy.
   */
  private async requestSignature(request: SignRequest): Promise<string> {
    switch (this.signStrategy.type) {
      case "wallet-popup":
        // Default web behavior: show wallet popup
        if (!this._provider) {
          throw new Error("No wallet connected for wallet-popup strategy");
        }
        return this._provider.getSigner().signMessage(request.message);

      case "auto-sign":
        if (!this._signer) {
          throw new Error("No signer available for auto-sign strategy");
        }
        return this._signer.signMessage(request.message);

      case "auto-reject":
        throw new Error("Sign request rejected by auto-reject strategy");

      case "callback": {
        const response = await (this.signStrategy as { type: "callback"; handler: (req: SignRequest) => Promise<SignResponse> }).handler(request);
        if (!response.approved) {
          throw new Error(response.reason ?? "Sign request rejected by callback");
        }
        // If callback provides signature, use it; otherwise sign with wallet
        if (response.signature) {
          return response.signature;
        }
        if (!this._provider) {
          throw new Error("No wallet connected and callback didn't provide signature");
        }
        return this._provider.getSigner().signMessage(request.message);
      }

      case "event-emitter": {
        return this.requestSignatureViaEmitter(
          request,
          (this.signStrategy as { type: "event-emitter"; emitter: EventTarget; timeout?: number }).emitter,
          (this.signStrategy as { type: "event-emitter"; emitter: EventTarget; timeout?: number }).timeout ?? 60000
        );
      }

      default:
        throw new Error(`Unknown sign strategy: ${(this.signStrategy as any).type}`);
    }
  }

  /**
   * Request signature via event emitter.
   */
  private requestSignatureViaEmitter(
    request: SignRequest,
    emitter: EventTarget,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Sign request timed out"));
      }, timeout);

      const respond = async (response: SignResponse) => {
        clearTimeout(timeoutId);
        if (!response.approved) {
          reject(new Error(response.reason ?? "Sign request rejected via emitter"));
        } else {
          // If response provides signature, use it; otherwise sign with wallet
          if (response.signature) {
            resolve(response.signature);
          } else if (this._provider) {
            const signature = await this._provider.getSigner().signMessage(request.message);
            resolve(signature);
          } else {
            reject(new Error("No wallet connected and emitter didn't provide signature"));
          }
        }
      };

      // Dispatch custom event with request and respond callback
      const event = new CustomEvent("sign-request", {
        detail: { request, respond },
      });
      emitter.dispatchEvent(event);
    });
  }

  // =========================================================================
  // Session Persistence
  // =========================================================================

  /**
   * Clear persisted session data.
   */
  async clearPersistedSession(address?: string): Promise<void> {
    if (!this.sessionStorage) return;

    const targetAddress = address ?? this._address;
    if (targetAddress) {
      await this.sessionStorage.clear(targetAddress);
    }
  }

  /**
   * Check if a session is persisted for an address.
   */
  isSessionPersisted(address: string): boolean {
    return this.sessionStorage?.exists(address) ?? false;
  }
}
