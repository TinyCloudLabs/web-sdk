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
} from "@tinycloudlabs/sdk-core";
import {
  TCWSessionManager,
  prepareSession,
  completeSessionSetup,
  ensureEip55,
  makeNamespaceId,
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
  private readonly signer: ISigner;
  private readonly signStrategy: SignStrategy;
  private readonly sessionStorage: ISessionStorage;
  private readonly domain: string;
  private readonly uri: string;
  private readonly statement?: string;
  private readonly namespacePrefix: string;
  private readonly defaultActions: Record<string, Record<string, string[]>>;
  private readonly sessionExpirationMs: number;

  private sessionManager: TCWSessionManager;
  private extensions: TCWExtension[] = [];
  private _session?: TCWClientSession;
  private _address?: string;
  private _chainId?: number;

  constructor(config: NodeUserAuthorizationConfig) {
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

    // Initialize session manager
    this.sessionManager = new TCWSessionManager();
  }

  /**
   * The current active session.
   */
  get session(): TCWClientSession | undefined {
    return this._session;
  }

  /**
   * Add an extension to the authorization flow.
   */
  extend(extension: TCWExtension): void {
    this.extensions.push(extension);
  }

  /**
   * Sign in and create a new session.
   */
  async signIn(): Promise<TCWClientSession> {
    // Get signer address and chain ID
    this._address = await this.signer.getAddress();
    this._chainId = await this.signer.getChainId();

    // Generate SIWE message
    const siweMessage = await this.generateSiweMessage(this._address);

    // Get signature based on strategy
    const signature = await this.requestSignature({
      address: this._address,
      chainId: this._chainId,
      message: siweMessage.prepareMessage(),
      type: "siwe",
    });

    // Complete sign-in
    return this.signInWithSignature(siweMessage, signature);
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
   */
  async signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<TCWClientSession> {
    const address = siweMessage.address;
    const chainId = siweMessage.chainId;

    // Create a session key
    const keyId = `session-${Date.now()}`;
    this.sessionManager.renameSessionKeyId("default", keyId);

    // Create namespace ID
    const namespaceId = makeNamespaceId(
      ensureEip55(address),
      chainId,
      this.namespacePrefix
    );

    // Get JWK for session key
    const jwkString = this.sessionManager.jwk(keyId);
    if (!jwkString) {
      throw new Error("Failed to create session key");
    }
    const jwk = JSON.parse(jwkString);

    // Prepare session
    const prepared = prepareSession({
      abilities: this.defaultActions,
      address: ensureEip55(address),
      chainId,
      domain: this.domain,
      issuedAt: siweMessage.issuedAt ?? new Date().toISOString(),
      expirationTime:
        siweMessage.expirationTime ??
        new Date(Date.now() + this.sessionExpirationMs).toISOString(),
      namespaceId,
      jwk,
    });

    // Complete session setup
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
      siwe: siweMessage.prepareMessage(),
      signature,
    };

    // Persist session with TinyCloud-specific data
    const persistedData: PersistedSessionData = {
      address,
      chainId,
      sessionKey: JSON.stringify(jwk),
      siwe: clientSession.siwe,
      signature,
      tinycloudSession: {
        delegationHeader: session.delegationHeader,
        delegationCid: session.delegationCid,
        namespaceId,
        verificationMethod: this.sessionManager.getDID(keyId),
      },
      expiresAt:
        siweMessage.expirationTime ??
        new Date(Date.now() + this.sessionExpirationMs).toISOString(),
      createdAt: siweMessage.issuedAt ?? new Date().toISOString(),
      version: "1.0",
    };
    await this.sessionStorage.save(address, persistedData);

    // Set current session
    this._session = clientSession;
    this._address = address;
    this._chainId = chainId;

    // Call extension hooks
    for (const ext of this.extensions) {
      if (ext.afterSignIn) {
        await ext.afterSignIn(clientSession);
      }
    }

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

    this._session = clientSession;
    this._address = address;
    this._chainId = persisted.chainId;

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
