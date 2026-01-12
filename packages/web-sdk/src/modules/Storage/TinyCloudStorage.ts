import {
  initialized,
  tinycloud,
  tcwSession,
} from "@tinycloudlabs/web-sdk-wasm";
import {
  ConfigOverrides,
  TCWClientSession,
} from "@tinycloudlabs/web-core/client";
import { generateNonce, SiweMessage } from "siwe";
import {
  SpaceConnection,
  activateSession,
  Response,
  Session,
  Authenticator,
} from "./tinycloud";
import { makeSpaceId } from "./tinycloud/module";
import {
  IStorage,
  ITinyCloud,
  IStorageListOptions,
  IStoragePutOptions,
  IStorageGetOptions,
  IStorageDeleteOptions,
} from "./interfaces";
import { IUserAuthorization, UserAuthorizationConnected } from "../..";
import { dispatchSDKEvent } from "../../notifications/ErrorHandler";
import { debug } from "../../utils/debug";
import {
  SessionPersistence,
  PersistedTinyCloudSession,
} from "../SessionPersistence";
import { WasmInitializer } from "../WasmInitializer";

export type DelegateParams = {
  /** The target file or folder you are sharing */
  target: string;
  /** The DID of the key you are delegating to. */
  delegateDID: string;
  /** The actions you are authorizing the delegate to do. */
  actions: string[];
  /** The statement in the SIWE message */
  statement?: string;
};

export type DelegateResponse = {
  /** The contents of the SIWE message */
  siwe: string;
  /** The signature of the SIWE message */
  signature: string;
  /** The version of the delegation issued */
  version: number;
};

/**
 * TinyCloudStorage provides decentralized storage functionality through the TinyCloud protocol.
 * This class implements both the IStorage and ITinyCloud interfaces.
 *
 * @remarks
 * TinyCloudStorage allows for storing, retrieving, and managing data in a decentralized way.
 * It handles authentication and session management for secure data operations.
 *
 * @public
 */
export class TinyCloudStorage implements IStorage, ITinyCloud {
  /**
   * The name of the Storage Extension (required by TCWExtension interface)
   * @public
   */
  public namespace: string = "tinycloud";

  /**
   * The prefix used for all storage operations.
   * @public
   */
  public prefix: string;

  /**
   * Array of TinyCloud host endpoints.
   * @private
   */
  private hosts: string[];

  /**
   * User authorization service for authentication.
   * @private
   */
  private userAuth: IUserAuthorization;

  /**
   * Reference to the TinyCloud WASM module.
   * @private
   */
  private tinycloudModule?: any;

  /**
   * The user's space identifier.
   * @public
   */
  public spaceId?: string;

  /**
   * The connection to the space.
   * @private
   */
  private _space?: SpaceConnection;

  /**
   * Session Manager. Holds session keys and session objects.
   * @private
   */
  private sessionManager?: any;

  /**
   * The domain to display in the SIWE message.
   * @public
   */
  domain?: string;

  /**
   * Session persistence handler for TinyCloud sessions.
   * @private
   */
  private sessionPersistence: SessionPersistence;

  /**
   * Creates a new instance of the TinyCloudStorage class.
   *
   * @param config - Configuration options for TinyCloud storage
   * @param config.hosts - Optional array of TinyCloud host endpoints
   * @param config.prefix - Optional prefix to use for all storage operations
   * @param userAuth - User authorization interface for authentication
   *
   * @public
   */
  constructor(config: any, userAuth: IUserAuthorization) {
    this.userAuth = userAuth;
    // Use hosts from UserAuthorization config to ensure consistency
    // Fall back to config.hosts for backwards compatibility, then production default
    this.hosts = userAuth.getTinycloudHosts?.() || [...(config?.hosts || []), "https://node.tinycloud.xyz"];
    this.prefix = config?.prefix || "";

    // Initialize session persistence
    this.sessionPersistence = new SessionPersistence();
  }

  public async afterConnect(
    tcw: UserAuthorizationConnected
  ): Promise<ConfigOverrides> {
    // WASM is already initialized by framework, get the modules
    const { tinycloudModule, sessionManager } =
      await WasmInitializer.ensureInitialized();
    this.tinycloudModule = tinycloudModule;
    this.sessionManager = sessionManager;

    const signer = tcw.provider.getSigner();
    const address = await signer.getAddress();
    const chain = await signer.getChainId();

    if (!address || typeof address !== 'string') {
      throw new Error(`TinyCloud: Invalid wallet address: ${address}`);
    }
    if (chain === undefined || chain === null) {
      throw new Error(`TinyCloud: Invalid chain ID: ${chain}`);
    }

    this.spaceId = makeSpaceId(address, Number(chain), "default");
    this.domain = tcw.config.siweConfig?.domain || window.location.hostname;
    return {};
  }

  public async targetedActions(): Promise<{ [target: string]: string[] }> {
    const actions = {};

    actions[`${this.spaceId}/capabilities/all`] = [
      "tinycloud.capabilities/read",
    ];
    actions[`${this.spaceId}/kv/${this.prefix}`] = [
      "tinycloud.kv/put",
      "tinycloud.kv/get",
      "tinycloud.kv/list",
      "tinycloud.kv/del",
      "tinycloud.kv/metadata",
    ];
    return actions;
  }

  public async generateTinyCloudSession(
    tcwSession: TCWClientSession
  ): Promise<Session> {
    // Defensive: ensure WASM is available (should already be initialized by framework)
    if (!this.tinycloudModule) {
      const { tinycloudModule, sessionManager } =
        await WasmInitializer.ensureInitialized();
      this.tinycloudModule = tinycloudModule;
      this.sessionManager = sessionManager;
    }

    // Validate required fields before calling WASM
    if (!this.spaceId || typeof this.spaceId !== 'string') {
      throw new Error(`TinyCloud: Invalid spaceId: ${this.spaceId}. Did afterConnect complete?`);
    }
    if (!tcwSession.siwe || typeof tcwSession.siwe !== 'string') {
      throw new Error(`TinyCloud: Invalid SIWE message: ${tcwSession.siwe}`);
    }
    if (!tcwSession.signature || typeof tcwSession.signature !== 'string') {
      throw new Error(`TinyCloud: Invalid signature: ${tcwSession.signature}`);
    }
    if (!tcwSession.sessionKey) {
      throw new Error('TinyCloud: Missing session key');
    }

    const siweMessage = new SiweMessage(tcwSession.siwe);
    const verificationMethod = siweMessage.uri;
    if (!verificationMethod || typeof verificationMethod !== 'string') {
      throw new Error(`TinyCloud: Invalid verification method from SIWE: ${verificationMethod}`);
    }

    const sessionData = {
      jwk: JSON.parse(tcwSession.sessionKey),
      spaceId: this.spaceId,
      service: "kv",
      siwe: tcwSession.siwe,
      signature: tcwSession.signature,
      verificationMethod,
    };

    const session = this.tinycloudModule.completeSessionSetup(sessionData);
    if (!session?.delegationHeader) {
      debug.error('Session created without delegationHeader:', {
        hasDelegationCid: !!session?.delegationCid,
        hasJwk: !!session?.jwk,
        spaceId: this.spaceId,
      });
    }
    return session;
  }

  public async afterSignIn(tcwSession: TCWClientSession): Promise<void> {
    const tinycloudHost = this.hosts[0];

    // Try to load persisted TinyCloud session first
    const persistedSession = await this.loadPersistedTinyCloudSession(
      tcwSession
    );
    if (persistedSession) {
      // Use existing delegation
      const authn = new Authenticator(persistedSession);
      this._space = new SpaceConnection(tinycloudHost, authn);
      return;
    }

    // Generate new session if no persisted session exists
    const session = await this.generateTinyCloudSession(tcwSession);

    debug.log('Activating session:', {
      host: tinycloudHost,
      hasDelegationHeader: !!session?.delegationHeader,
      spaceId: this.spaceId,
    });

    let authn;
    try {
      authn = await activateSession(session, tinycloudHost);
    } catch (error: any) {
      const msg = error?.msg ?? error?.message ?? String(error);
      dispatchSDKEvent.error(
        "storage.session_delegation_failed",
        "Failed to submit session key delegation to TinyCloud",
        msg
      );
      throw new Error(
        `Failed to submit session key delegation to TinyCloud: ${msg}`
      );
    }

    this._space = new SpaceConnection(tinycloudHost, authn);

    // Persist the new TinyCloud session
    await this.persistTinyCloudSession(session, tcwSession);
  }

  /**
   * Attempts to load a persisted TinyCloud session
   * @private
   */
  private async loadPersistedTinyCloudSession(
    tcwSession: TCWClientSession
  ): Promise<Session | null> {
    try {
      const persistedSession = await this.sessionPersistence.loadSession(
        tcwSession.address
      );

      if (!persistedSession?.tinycloudSession) {
        return null;
      }

      // Clear sessions from before orbit->namespace->space migration that have orbitId/namespaceId instead of spaceId
      if (!persistedSession.tinycloudSession.spaceId) {
        debug.log('Clearing legacy session without spaceId');
        await this.sessionPersistence.clearSession(tcwSession.address);
        return null;
      }

      const session: Session = {
        delegationHeader: persistedSession.tinycloudSession.delegationHeader,
        delegationCid: persistedSession.tinycloudSession.delegationCid,
        jwk: JSON.parse(tcwSession.sessionKey),
        spaceId: persistedSession.tinycloudSession.spaceId,
        verificationMethod:
          persistedSession.tinycloudSession.verificationMethod,
      };

      return session;
    } catch (error) {
      debug.warn("Failed to load persisted TinyCloud session:", error);
      return null;
    }
  }

  /**
   * Persists a TinyCloud session for future use
   * @private
   */
  private async persistTinyCloudSession(
    session: Session,
    tcwSession: TCWClientSession
  ): Promise<void> {
    try {
      const existingSession = await this.sessionPersistence.loadSession(
        tcwSession.address
      );

      const tinycloudSessionData = {
        delegationHeader: session.delegationHeader,
        delegationCid: session.delegationCid,
        spaceId: session.spaceId,
        verificationMethod: session.verificationMethod,
      };

      if (existingSession) {
        existingSession.tinycloudSession = tinycloudSessionData;
        await this.sessionPersistence.saveSession(existingSession);
      } else {
        const expirationTime = new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString();

        const newPersistedSession = {
          address: tcwSession.address,
          chainId: tcwSession.chainId,
          sessionKey: tcwSession.sessionKey,
          siwe: tcwSession.siwe,
          signature: tcwSession.signature,
          tinycloudSession: tinycloudSessionData,
          expiresAt: expirationTime,
          createdAt: new Date().toISOString(),
          version: "1.0.0",
        };

        await this.sessionPersistence.saveSession(newPersistedSession);
      }
    } catch (error) {
      debug.warn("Failed to persist TinyCloud session:", error);
    }
  }

  /**
   * Gets the active space connection.
   * Note: This is the TinyCloud user space (data container), not to be confused with
   * ReCap ability namespaces (action categories like "kv", "tinycloud.kv").
   * @private
   */
  get spaceConnection(): SpaceConnection {
    if (!this._space) {
      dispatchSDKEvent.error(
        "storage.not_connected",
        "TinyCloudStorage is not connected",
        "Please sign in first to establish a connection"
      );
      throw new Error("TinyCloudStorage is not connected");
    }
    return this._space;
  }

  /**
   * Retrieves data from storage by key.
   *
   * @param key - The key to retrieve
   * @param options - Optional configuration for the get operation
   * @returns A Promise containing the response with the data
   *
   * @example
   * ```ts
   * const response = await tinycloudStorage.get('myData');
   * console.log(response.data);
   * ```
   *
   * @public
   */
  public async get(
    key: string,
    options: IStorageGetOptions = {}
  ): Promise<Response> {
    const defaultOptions = {
      prefix: this.prefix,
    };
    const { prefix, request } = { ...defaultOptions, ...options };
    return this.spaceConnection.get(`${prefix}/${key}`, request);
  }

  /**
   * Stores data in storage with the specified key.
   *
   * @param key - The key to store the data under
   * @param value - The value to store
   * @param options - Optional configuration for the put operation
   * @returns A Promise containing the response from the storage operation
   *
   * @example
   * ```ts
   * const data = { name: 'Example', value: 42 };
   * await tinycloudStorage.put('myData', data);
   * ```
   *
   * @public
   */
  public async put(
    key: string,
    value: any,
    options: IStoragePutOptions = {}
  ): Promise<Response> {
    const defaultOptions = {
      prefix: this.prefix,
    };
    const { prefix, request } = { ...defaultOptions, ...options };
    try {
      const response = await this.spaceConnection.put(
        `${prefix || this.prefix}/${key}`,
        value,
        request
      );
      dispatchSDKEvent.success("Data stored successfully");
      return response;
    } catch (error) {
      dispatchSDKEvent.error(
        "storage.upload_failed",
        "Failed to store data",
        error.message
      );
      throw error;
    }
  }

  /**
   * Lists keys in storage, optionally filtered by path.
   *
   * @param options - Configuration options for the list operation
   * @param options.prefix - Custom prefix to use instead of the default
   * @param options.path - Sub-path to list within the prefix
   * @param options.removePrefix - Whether to remove the prefix from the returned keys
   * @param options.request - Additional request options
   * @returns A Promise containing the response with the list of keys
   *
   * @example
   * ```ts
   * const response = await tinycloudStorage.list({
   *   path: 'folder',
   *   removePrefix: true
   * });
   * console.log(response.data); // List of keys
   * ```
   *
   * @public
   */
  public async list(options: IStorageListOptions = {}): Promise<Response> {
    const defaultOptions = {
      prefix: this.prefix,
      removePrefix: false,
    };
    const { prefix, path, request, removePrefix } = {
      ...defaultOptions,
      ...options,
    };
    const p = path ? `${prefix}/${path}` : `${prefix}/`;
    const response = await this.spaceConnection.list(prefix, request);
    // remove prefix from keys
    return removePrefix
      ? { ...response, data: response.data.map((key) => key.slice(p.length)) }
      : response;
  }

  /**
   * Deletes the data stored under the specified key.
   *
   * @param key - The key to delete
   * @param options - Optional configuration for the delete operation
   * @returns A Promise containing the response from the delete operation
   *
   * @example
   * ```ts
   * await tinycloudStorage.delete('myData');
   * ```
   *
   * @public
   */
  public async delete(
    key: string,
    options: IStorageDeleteOptions = {}
  ): Promise<Response> {
    const defaultOptions = {
      prefix: this.prefix,
    };
    const { prefix, request } = { ...defaultOptions, ...options };
    return this.spaceConnection.delete(`${prefix}/${key}`, request);
  }

  public async deleteAll(prefix?: string): Promise<Response[]> {
    if (prefix) {
      return this.spaceConnection.deleteAll(`${this.prefix}/${prefix}`);
    } else {
      return this.spaceConnection.deleteAll(this.prefix);
    }
  }

  public async activateSession(
    tcwSession?: TCWClientSession,
    onError?: () => void
  ): Promise<boolean> {
    try {
      if (!tcwSession) {
        ({ session: tcwSession } = this.userAuth);
      }

      const session = await this.generateTinyCloudSession(tcwSession);

      const tinycloudHost = this.hosts[0];
      await activateSession(session, tinycloudHost).then((authn) => {
        this._space = new SpaceConnection(tinycloudHost, authn);
      });
      return true;
    } catch (error) {
      if (onError) {
        onError();
      }
      return false;
    }
  }

  public async delegate({
    target,
    delegateDID,
    actions,
    statement,
  }: DelegateParams): Promise<DelegateResponse> {
    // add actions to session builder
    this.sessionManager.resetCapability();
    this.sessionManager.addTargetedActions(target, actions);

    // create siwe message
    const address =
      this.userAuth?.address() ||
      (await this.userAuth.getSigner().getAddress());
    const chainId: number =
      this.userAuth?.chainId() ||
      (await this.userAuth.getSigner().getChainId());
    const siweConfig = {
      statement,
      address,
      walletAddress: address,
      chainId,
      domain: globalThis.location.hostname,
      issuedAt: new Date().toISOString(),
      nonce: generateNonce(),
    };

    // build and sign message
    const siwe = await this.sessionManager.build(siweConfig, null, delegateDID);

    const signature = await this.userAuth.signMessage(siwe);

    return {
      siwe,
      signature,
      version: 1,
    };
  }

  public async generateSharingLink(
    path: string,
    params?: any
  ): Promise<string> {
    // generate key
    const allKeys = await this.sessionManager.listSessionKeys();
    const keyId = await this.sessionManager.createSessionKey(
      `sharekey-${allKeys.length}`
    );
    const sessionKey = this.sessionManager.jwk(keyId);
    const delegateDID = await this.sessionManager.getDID(keyId);

    // get file target + permissions
    const target = `${this.spaceId}/kv/${path}`;
    const actions = ["kv/get", "kv/metadata"];

    // delegate permission to target
    const { siwe, signature } = await this.delegate({
      target,
      delegateDID,
      actions,
      statement: "I am giving permission to read this data.",
    });

    // create tcw + tinycloud session
    const sessionData: TCWClientSession = {
      address: this.userAuth.address(),
      walletAddress: this.userAuth.address(),
      chainId: this.userAuth.chainId(),
      sessionKey,
      siwe,
      signature,
    };

    const session = await this.generateTinyCloudSession(sessionData);
    /* activate session */
    const tinycloudHost = this.hosts[0];
    await activateSession(session, tinycloudHost).catch((error: any) => {
      const status = error?.status;
      const msg = error?.msg ?? error?.message ?? String(error);
      if (status !== 404) {
        dispatchSDKEvent.error(
          "storage.sharing_link_delegation_failed",
          "Failed to submit session key delegation to TinyCloud",
          msg
        );
        throw new Error(
          `Failed to submit session key delegation to TinyCloud: ${msg}`
        );
      }
    });
    /* end activate session */

    // store session with key
    // bundle delegation and encode
    const shareData = {
      path,
      tinycloudHost: this.hosts[0],
      session,
    };

    const shareJSON = JSON.stringify(shareData);
    const shareBase64 = btoa(shareJSON);
    return shareBase64;
  }

  public async retrieveSharingLink(encodedShare: string): Promise<Response> {
    (global as any).tinycloudModule = await tinycloud;

    // read key and delegation bundle
    const shareJSON = atob(encodedShare);
    const { path, tinycloudHost, session } = JSON.parse(shareJSON);

    // activate session and retrieve data
    try {
      const authn = await activateSession(session, tinycloudHost);
      const space = new SpaceConnection(tinycloudHost, authn);
      const response = await space.get(path);
      return response;
    } catch (error: any) {
      const status = error?.status;
      const msg = error?.msg ?? error?.message ?? String(error);
      if (status !== 404) {
        dispatchSDKEvent.error(
          "storage.sharing_link_retrieval_failed",
          "Failed to retrieve shared data",
          msg
        );
        throw new Error(
          `Failed to submit session key delegation to TinyCloud: ${msg}`
        );
      }
    }
  }
}

export default TinyCloudStorage;
