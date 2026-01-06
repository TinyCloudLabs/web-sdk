import { EventEmitter } from "events";
import { SiweMessage } from "siwe";
import {
  IUserAuthorization,
  ISigner,
  ISessionStorage,
  TCWClientSession,
  TCWExtension,
  PartialSiweMessage,
  PersistedSessionData,
  TinyCloudSession,
  fetchPeerId,
  submitHostDelegation,
  activateSessionWithHost,
} from "@tinycloudlabs/sdk-core";
import {
  TCWSessionManager,
  prepareSession,
  completeSessionSetup,
  ensureEip55,
  makeNamespaceId,
  initPanicHook,
  generateHostSIWEMessage,
  siweToDelegationHeaders,
} from "@tinycloudlabs/node-sdk-wasm";
import {
  SignStrategy,
  SignRequest,
  SignResponse,
  defaultSignStrategy,
} from "./strategies";
import { MemorySessionStorage } from "../storage/MemorySessionStorage";

/**
 * Configuration for NodeUserAuthorization.
 */
export interface NodeUserAuthorizationConfig {
  /** The signer used for signing messages */
  signer: ISigner;
  /** Sign strategy for handling sign requests */
  signStrategy?: SignStrategy;
  /** Session storage implementation */
  sessionStorage?: ISessionStorage;
  /** Domain for SIWE messages */
  domain: string;
  /** URI for SIWE messages (default: domain) */
  uri?: string;
  /** Statement included in SIWE messages */
  statement?: string;
  /** Namespace prefix for new sessions */
  namespacePrefix?: string;
  /** Default actions for sessions */
  defaultActions?: Record<string, Record<string, string[]>>;
  /** Session expiration time in milliseconds (default: 1 hour) */
  sessionExpirationMs?: number;
  /** Automatically create namespace if it doesn't exist (default: true) */
  autoCreateNamespace?: boolean;
  /** TinyCloud server endpoints (default: ["https://node.tinycloud.xyz"]) */
  tinycloudHosts?: string[];
}

/**
 * Node.js implementation of IUserAuthorization.
 *
 * Supports multiple sign strategies for different use cases:
 * - auto-sign: Automatically approve all sign requests (trusted backends)
 * - auto-reject: Reject all sign requests (read-only mode)
 * - callback: Delegate to a custom callback function (CLI prompts)
 * - event-emitter: Emit sign requests as events (async workflows)
 *
 * @example
 * ```typescript
 * // Auto-sign for backend services
 * const auth = new NodeUserAuthorization({
 *   signer: new PrivateKeySigner(process.env.PRIVATE_KEY),
 *   signStrategy: { type: 'auto-sign' },
 *   domain: 'api.myapp.com',
 * });
 *
 * // Callback for CLI prompts
 * const auth = new NodeUserAuthorization({
 *   signer,
 *   signStrategy: {
 *     type: 'callback',
 *     handler: async (req) => {
 *       const approved = await promptUser(`Sign for ${req.address}?`);
 *       return { approved };
 *     }
 *   },
 *   domain: 'cli.myapp.com',
 * });
 * ```
 */
export class NodeUserAuthorization implements IUserAuthorization {
  /** Flag to ensure WASM panic hook is only initialized once */
  private static wasmInitialized = false;

  private readonly signer: ISigner;
  private readonly signStrategy: SignStrategy;
  private readonly sessionStorage: ISessionStorage;
  private readonly domain: string;
  private readonly uri: string;
  private readonly statement?: string;
  private readonly namespacePrefix: string;
  private readonly defaultActions: Record<string, Record<string, string[]>>;
  private readonly sessionExpirationMs: number;
  private readonly autoCreateNamespace: boolean;
  private readonly tinycloudHosts: string[];

  private sessionManager: TCWSessionManager;
  private extensions: TCWExtension[] = [];
  private _session?: TCWClientSession;
  private _tinyCloudSession?: TinyCloudSession;
  private _address?: string;
  private _chainId?: number;

  constructor(config: NodeUserAuthorizationConfig) {
    // Initialize WASM panic hook once (improves error messages from WASM)
    if (!NodeUserAuthorization.wasmInitialized) {
      initPanicHook();
      NodeUserAuthorization.wasmInitialized = true;
    }

    this.signer = config.signer;
    this.signStrategy = config.signStrategy ?? defaultSignStrategy;
    this.sessionStorage = config.sessionStorage ?? new MemorySessionStorage();
    this.domain = config.domain;
    this.uri = config.uri ?? `https://${config.domain}`;
    this.statement = config.statement;
    this.namespacePrefix = config.namespacePrefix ?? "default";
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
    };
    this.sessionExpirationMs = config.sessionExpirationMs ?? 60 * 60 * 1000;
    this.autoCreateNamespace = config.autoCreateNamespace ?? true;
    this.tinycloudHosts = config.tinycloudHosts ?? ["https://node.tinycloud.xyz"];

    // Initialize session manager
    this.sessionManager = new TCWSessionManager();
  }

  /**
   * The current active session (web-core compatible).
   */
  get session(): TCWClientSession | undefined {
    return this._session;
  }

  /**
   * The current TinyCloud session with full delegation data.
   * Includes namespaceId, delegationHeader, and delegationCid.
   */
  get tinyCloudSession(): TinyCloudSession | undefined {
    return this._tinyCloudSession;
  }

  /**
   * Add an extension to the authorization flow.
   */
  extend(extension: TCWExtension): void {
    this.extensions.push(extension);
  }

  /**
   * Get the namespace ID for the current session.
   */
  getNamespaceId(): string | undefined {
    return this._tinyCloudSession?.namespaceId;
  }

  /**
   * Create the namespace on the TinyCloud server (host delegation).
   * This registers the user as the owner of the namespace.
   */
  private async hostNamespace(): Promise<boolean> {
    if (!this._tinyCloudSession || !this._address || !this._chainId) {
      throw new Error("Must be signed in to host namespace");
    }

    const host = this.tinycloudHosts[0];
    const namespaceId = this._tinyCloudSession.namespaceId;

    // Get peer ID from TinyCloud server
    const peerId = await fetchPeerId(host, namespaceId);

    // Generate host SIWE message
    const siwe = generateHostSIWEMessage({
      address: this._address,
      chainId: this._chainId,
      domain: this.domain,
      issuedAt: new Date().toISOString(),
      namespaceId,
      peerId,
    });

    // Sign the message
    const signature = await this.signMessage(siwe);

    // Convert to delegation headers and submit
    const headers = siweToDelegationHeaders({ siwe, signature });
    const result = await submitHostDelegation(host, headers);

    return result.success;
  }

  /**
   * Ensure the user's namespace exists on the TinyCloud server.
   * Creates the namespace if it doesn't exist and autoCreateNamespace is enabled.
   *
   * @throws Error if namespace creation fails or is disabled and namespace doesn't exist
   */
  async ensureNamespaceExists(): Promise<void> {
    if (!this._tinyCloudSession) {
      throw new Error("Must be signed in to ensure namespace exists");
    }

    const host = this.tinycloudHosts[0];
    console.log(`[ensureNamespaceExists] host=${host}, namespaceId=${this._tinyCloudSession.namespaceId}`);

    // Try to activate the session (this checks if namespace exists)
    const result = await activateSessionWithHost(
      host,
      this._tinyCloudSession.delegationHeader
    );

    console.log(`[ensureNamespaceExists] activation result: status=${result.status}, success=${result.success}, error=${result.error}`);

    if (result.success) {
      // Namespace exists and session is activated
      return;
    }

    if (result.status === 404) {
      // Namespace doesn't exist
      if (!this.autoCreateNamespace) {
        throw new Error(
          `Namespace does not exist: ${this._tinyCloudSession.namespaceId}. ` +
            `Set autoCreateNamespace: true to create it automatically.`
        );
      }

      // Create the namespace
      const created = await this.hostNamespace();
      if (!created) {
        throw new Error(
          `Failed to create namespace: ${this._tinyCloudSession.namespaceId}`
        );
      }

      // Small delay to allow namespace creation to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Retry activation after creating namespace
      const retryResult = await activateSessionWithHost(
        host,
        this._tinyCloudSession.delegationHeader
      );

      if (!retryResult.success) {
        throw new Error(
          `Failed to activate session after creating namespace: ${retryResult.error}`
        );
      }

      return;
    }

    // Other error
    throw new Error(`Failed to activate session: ${result.error}`);
  }

  /**
   * Sign in and create a new session.
   *
   * This follows the correct SIWE-ReCap flow:
   * 1. Create session key and get JWK
   * 2. Call prepareSession() which generates the SIWE with ReCap capabilities
   * 3. Sign the SIWE string from prepareSession
   * 4. Call completeSessionSetup() with the prepared session + signature
   */
  async signIn(): Promise<TCWClientSession> {
    // Get signer address and chain ID
    this._address = await this.signer.getAddress();
    this._chainId = await this.signer.getChainId();

    const address = ensureEip55(this._address);
    const chainId = this._chainId;

    // Create a session key
    const keyId = `session-${Date.now()}`;
    this.sessionManager.renameSessionKeyId("default", keyId);

    // Get JWK for session key
    const jwkString = this.sessionManager.jwk(keyId);
    if (!jwkString) {
      throw new Error("Failed to create session key");
    }
    const jwk = JSON.parse(jwkString);

    // Create namespace ID
    const namespaceId = makeNamespaceId(address, chainId, this.namespacePrefix);

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
      namespaceId,
      jwk,
    });

    // Sign the SIWE message from prepareSession (NOT a separately generated SIWE)
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
    const clientSession: TCWClientSession = {
      address,
      walletAddress: address,
      chainId,
      sessionKey: keyId,
      siwe: prepared.siwe,
      signature,
    };

    // Create TinyCloud session with full delegation data
    // Use sessionManager.getDID(keyId) for verificationMethod to get properly formatted DID URL
    // The prepared.verificationMethod from Rust WASM has a bug that doubles the DID fragment
    const tinyCloudSession: TinyCloudSession = {
      address,
      chainId,
      sessionKey: keyId,
      namespaceId,
      delegationCid: session.delegationCid,
      delegationHeader: session.delegationHeader,
      verificationMethod: this.sessionManager.getDID(keyId),
      jwk,
      siwe: prepared.siwe,
      signature,
    };

    // Persist session with TinyCloud-specific data
    const persistedData: PersistedSessionData = {
      address,
      chainId,
      sessionKey: JSON.stringify(jwk),
      siwe: prepared.siwe,
      signature,
      tinycloudSession: {
        delegationHeader: session.delegationHeader,
        delegationCid: session.delegationCid,
        namespaceId,
        verificationMethod: this.sessionManager.getDID(keyId),
      },
      expiresAt: expirationTime.toISOString(),
      createdAt: now.toISOString(),
      version: "1.0",
    };
    await this.sessionStorage.save(address, persistedData);

    // Set current session
    this._session = clientSession;
    this._tinyCloudSession = tinyCloudSession;
    this._address = address;
    this._chainId = chainId;

    // Call extension hooks
    for (const ext of this.extensions) {
      if (ext.afterSignIn) {
        await ext.afterSignIn(clientSession);
      }
    }

    // Ensure namespace exists (creates if needed when autoCreateNamespace is true)
    await this.ensureNamespaceExists();

    return clientSession;
  }

  /**
   * Sign out and clear the current session.
   */
  async signOut(): Promise<void> {
    if (this._address) {
      await this.clearPersistedSession(this._address);
    }
    this._session = undefined;
  }

  /**
   * Get the current wallet/signer address.
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
   * Sign a message with the connected signer.
   */
  async signMessage(message: string): Promise<string> {
    if (!this._address) {
      this._address = await this.signer.getAddress();
    }
    if (!this._chainId) {
      this._chainId = await this.signer.getChainId();
    }

    return this.requestSignature({
      address: this._address,
      chainId: this._chainId,
      message,
      type: "message",
    });
  }

  /**
   * Generate a SIWE message for custom signing flows.
   *
   * @deprecated This method generates a plain SIWE message without ReCap capabilities.
   * For TinyCloud sessions, use `signIn()` instead, which uses `prepareSession()` to
   * generate the correct SIWE message with ReCap capabilities embedded.
   *
   * If you need a custom signing flow, call `prepareSession()` directly and sign
   * the returned `siwe` string, then pass both to `signInWithPreparedSession()`.
   */
  async generateSiweMessage(
    address: string,
    partial?: PartialSiweMessage
  ): Promise<SiweMessage> {
    const chainId = partial?.chainId ?? (await this.signer.getChainId());
    const now = new Date();
    const expirationTime = new Date(now.getTime() + this.sessionExpirationMs);

    // Generate nonce
    const nonce =
      partial?.nonce ??
      Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

    // Collect resources from extensions
    const resources: string[] = [...(partial?.resources ?? [])];
    for (const ext of this.extensions) {
      if (ext.namespace) {
        // Add extension namespace as resource
        resources.push(`urn:${ext.namespace}`);
      }
    }

    const siweMessage = new SiweMessage({
      domain: partial?.domain ?? this.domain,
      address: ensureEip55(address),
      statement: partial?.statement ?? this.statement,
      uri: partial?.uri ?? this.uri,
      version: partial?.version ?? "1",
      chainId,
      nonce,
      issuedAt: partial?.issuedAt ?? now.toISOString(),
      expirationTime: partial?.expirationTime ?? expirationTime.toISOString(),
      notBefore: partial?.notBefore,
      requestId: partial?.requestId,
      resources: resources.length > 0 ? resources : undefined,
    });

    return siweMessage;
  }

  /**
   * Complete sign-in with a pre-signed message.
   *
   * @deprecated This method is broken and should not be used. The signature must be
   * over the SIWE message generated by `prepareSession()`, not a separately generated
   * SIWE message. Use `signIn()` for automatic signing or `signInWithPreparedSession()`
   * for custom signing flows where you need to sign externally.
   *
   * The issue: This method calls `prepareSession()` internally which creates a NEW
   * SIWE message with ReCap capabilities. The signature you provide was for a
   * different SIWE message, so the server will fail to verify it.
   *
   * @throws Error always - this method is no longer functional
   */
  async signInWithSignature(
    _siweMessage: SiweMessage,
    _signature: string
  ): Promise<TCWClientSession> {
    throw new Error(
      "signInWithSignature is deprecated and broken. " +
        "Use signIn() for automatic signing, or use signInWithPreparedSession() " +
        "with a prepared session from prepareSession(). " +
        "See the documentation for the correct SIWE-ReCap signing flow."
    );
  }

  /**
   * Prepare a session for external signing.
   *
   * Use this method when you need to sign the SIWE message externally (e.g., via
   * a hardware wallet, multi-sig, or external service). After obtaining the signature,
   * call `signInWithPreparedSession()` to complete the sign-in.
   *
   * @example
   * ```typescript
   * const { prepared, keyId, jwk } = await auth.prepareSessionForSigning();
   * const signature = await externalSigner.signMessage(prepared.siwe);
   * const session = await auth.signInWithPreparedSession(prepared, signature, keyId, jwk);
   * ```
   */
  async prepareSessionForSigning(): Promise<{
    prepared: {
      siwe: string;
      jwk: object;
      namespaceId: string;
      verificationMethod: string;
    };
    keyId: string;
    jwk: object;
    address: string;
    chainId: number;
  }> {
    const address = ensureEip55(await this.signer.getAddress());
    const chainId = await this.signer.getChainId();

    // Create a session key
    const keyId = `session-${Date.now()}`;
    this.sessionManager.renameSessionKeyId("default", keyId);

    // Get JWK for session key
    const jwkString = this.sessionManager.jwk(keyId);
    if (!jwkString) {
      throw new Error("Failed to create session key");
    }
    const jwk = JSON.parse(jwkString);

    // Create namespace ID
    const namespaceId = makeNamespaceId(address, chainId, this.namespacePrefix);

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
      namespaceId,
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
   *
   * Use this method after obtaining a signature for the SIWE message from
   * `prepareSessionForSigning()`. The signature MUST be over `prepared.siwe`.
   *
   * @param prepared - The prepared session from `prepareSessionForSigning()`
   * @param signature - The signature over `prepared.siwe`
   * @param keyId - The session key ID from `prepareSessionForSigning()`
   * @param jwk - The JWK from `prepareSessionForSigning()`
   */
  async signInWithPreparedSession(
    prepared: {
      siwe: string;
      jwk: object;
      namespaceId: string;
      verificationMethod: string;
    },
    signature: string,
    keyId: string,
    jwk: object
  ): Promise<TCWClientSession> {
    // Complete session setup with the prepared session + signature
    const session = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Parse address and chainId from the prepared session
    // The SIWE message contains this info, but we need to extract it
    // For now, we'll get it from the signer since it should match
    const address = ensureEip55(await this.signer.getAddress());
    const chainId = await this.signer.getChainId();

    // Create client session (web-core compatible)
    const clientSession: TCWClientSession = {
      address,
      walletAddress: address,
      chainId,
      sessionKey: keyId,
      siwe: prepared.siwe,
      signature,
    };

    // Create TinyCloud session with full delegation data
    // Use sessionManager.getDID(keyId) for properly formatted DID URL
    const tinyCloudSession: TinyCloudSession = {
      address,
      chainId,
      sessionKey: keyId,
      namespaceId: prepared.namespaceId,
      delegationCid: session.delegationCid,
      delegationHeader: session.delegationHeader,
      verificationMethod: this.sessionManager.getDID(keyId),
      jwk,
      siwe: prepared.siwe,
      signature,
    };

    // Extract expiration from SIWE message (parse the string)
    const expirationMatch = prepared.siwe.match(/Expiration Time: (.+)/);
    const issuedAtMatch = prepared.siwe.match(/Issued At: (.+)/);
    const expiresAt =
      expirationMatch?.[1] ??
      new Date(Date.now() + this.sessionExpirationMs).toISOString();
    const createdAt = issuedAtMatch?.[1] ?? new Date().toISOString();

    // Persist session with TinyCloud-specific data
    const persistedData: PersistedSessionData = {
      address,
      chainId,
      sessionKey: JSON.stringify(jwk),
      siwe: prepared.siwe,
      signature,
      tinycloudSession: {
        delegationHeader: session.delegationHeader,
        delegationCid: session.delegationCid,
        namespaceId: prepared.namespaceId,
        verificationMethod: this.sessionManager.getDID(keyId),
      },
      expiresAt,
      createdAt,
      version: "1.0",
    };
    await this.sessionStorage.save(address, persistedData);

    // Set current session
    this._session = clientSession;
    this._tinyCloudSession = tinyCloudSession;
    this._address = address;
    this._chainId = chainId;

    // Call extension hooks
    for (const ext of this.extensions) {
      if (ext.afterSignIn) {
        await ext.afterSignIn(clientSession);
      }
    }

    // Ensure namespace exists (creates if needed when autoCreateNamespace is true)
    await this.ensureNamespaceExists();

    return clientSession;
  }

  /**
   * Attempt to resume a previously persisted session.
   */
  async tryResumeSession(address: string): Promise<TCWClientSession | null> {
    const persisted = await this.sessionStorage.load(address);
    if (!persisted) {
      return null;
    }

    // Check expiration
    const expiresAt = new Date(persisted.expiresAt);
    if (expiresAt < new Date()) {
      await this.sessionStorage.clear(address);
      return null;
    }

    // Restore session key
    const keyId = `restored-${Date.now()}`;
    // Import the JWK into a new session manager
    this.sessionManager = new TCWSessionManager();
    this.sessionManager.renameSessionKeyId("default", keyId);

    // Create client session from persisted data (web-core compatible)
    const clientSession: TCWClientSession = {
      address,
      walletAddress: address,
      chainId: persisted.chainId,
      sessionKey: keyId,
      siwe: persisted.siwe,
      signature: persisted.signature,
      ens: persisted.ens,
    };

    // Restore TinyCloud session if available
    if (persisted.tinycloudSession) {
      // Parse JWK from persisted session key
      const jwk = JSON.parse(persisted.sessionKey);
      this._tinyCloudSession = {
        address,
        chainId: persisted.chainId,
        sessionKey: keyId,
        namespaceId: persisted.tinycloudSession.namespaceId,
        delegationCid: persisted.tinycloudSession.delegationCid,
        delegationHeader: persisted.tinycloudSession.delegationHeader,
        verificationMethod: persisted.tinycloudSession.verificationMethod,
        jwk,
        siwe: persisted.siwe,
        signature: persisted.signature,
      };
    }

    this._session = clientSession;
    this._address = address;
    this._chainId = persisted.chainId;

    // Activate session with server (namespace should already exist for resumed sessions)
    await this.ensureNamespaceExists();

    return clientSession;
  }

  /**
   * Clear persisted session data.
   */
  async clearPersistedSession(address?: string): Promise<void> {
    const targetAddress = address ?? this._address;
    if (targetAddress) {
      await this.sessionStorage.clear(targetAddress);
    }
  }

  /**
   * Check if a session is persisted for an address.
   */
  isSessionPersisted(address: string): boolean {
    return this.sessionStorage.exists(address);
  }

  /**
   * Request a signature based on the configured strategy.
   */
  private async requestSignature(request: SignRequest): Promise<string> {
    switch (this.signStrategy.type) {
      case "auto-sign":
        return this.signer.signMessage(request.message);

      case "auto-reject":
        throw new Error("Sign request rejected by auto-reject strategy");

      case "callback": {
        const response = await this.signStrategy.handler(request);
        if (!response.approved) {
          throw new Error(
            response.reason ?? "Sign request rejected by callback"
          );
        }
        // If callback provides signature, use it; otherwise sign with signer
        return (
          response.signature ?? (await this.signer.signMessage(request.message))
        );
      }

      case "event-emitter": {
        return this.requestSignatureViaEmitter(
          request,
          this.signStrategy.emitter,
          this.signStrategy.timeout ?? 60000
        );
      }

      default:
        throw new Error(`Unknown sign strategy: ${(this.signStrategy as any).type}`);
    }
  }

  /**
   * Request signature via event emitter with timeout.
   */
  private requestSignatureViaEmitter(
    request: SignRequest,
    emitter: EventEmitter,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Sign request timed out"));
      }, timeout);

      const respond = async (response: SignResponse) => {
        clearTimeout(timeoutId);
        if (!response.approved) {
          reject(
            new Error(response.reason ?? "Sign request rejected via emitter")
          );
        } else {
          // If response provides signature, use it; otherwise sign with signer
          const signature =
            response.signature ??
            (await this.signer.signMessage(request.message));
          resolve(signature);
        }
      };

      emitter.emit("sign-request", request, respond);
    });
  }
}
