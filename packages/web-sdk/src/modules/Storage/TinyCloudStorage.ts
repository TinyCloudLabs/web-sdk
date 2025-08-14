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
  OrbitConnection,
  activateSession,
  hostOrbit,
  Response,
  Session,
  Authenticator,
} from "./tinycloud";
import { makeOrbitId } from "./tinycloud/module";
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
import { showOrbitCreationModal } from "../../notifications/ModalManager";
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
   * The namespace identifier for TinyCloud storage.
   * @public
   */
  public namespace = "tinycloud";

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
   * Whether to automatically create a new orbit if one doesn't exist.
   * @private
   */
  private autoCreateNewOrbit: boolean;

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
   * The user's orbit identifier.
   * @public
   */
  public orbitId?: string;

  /**
   * The connection to the orbit.
   * @private
   */
  private _orbit?: OrbitConnection;

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
   * @param config.autoCreateNewOrbit - Whether to automatically create a new orbit if one doesn't exist
   * @param userAuth - User authorization interface for authentication
   *
   * @public
   */
  constructor(config: any, userAuth: IUserAuthorization) {
    this.userAuth = userAuth;
    this.hosts = [...(config?.hosts || []), "https://node.tinycloud.xyz"];
    this.prefix = config?.prefix || "";
    this.autoCreateNewOrbit =
      config?.autoCreateNewOrbit === undefined
        ? true
        : config?.autoCreateNewOrbit;

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

    const address = await tcw.provider.getSigner().getAddress();
    const chain = await tcw.provider.getSigner().getChainId();

    this.orbitId = makeOrbitId(address, chain, "default");
    console.log(this.orbitId);

    this.domain = tcw.config.siweConfig?.domain;
    return {};
  }

  public async targetedActions(): Promise<{ [target: string]: string[] }> {
    const actions = {};
    actions[`${this.orbitId}/capabilities/all`] = ["tinycloud.capabilities/read"];
    actions[`${this.orbitId}/kv/${this.prefix}`] = [
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

    const sessionData = {
      jwk: JSON.parse(tcwSession.sessionKey),
      orbitId: `${this.namespace}:${this.orbitId}`,
      service: "kv",
      siwe: tcwSession.siwe,
      signature: tcwSession.signature,
      verificationMethod: new SiweMessage(tcwSession.siwe).uri,
    };

    return this.tinycloudModule.completeSessionSetup(
      sessionData
    )
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
      this._orbit = new OrbitConnection(tinycloudHost, authn);
      return;
    }

    // Generate new session if no persisted session exists
    const session = await this.generateTinyCloudSession(tcwSession);

    let authn;
    try {
      authn = await activateSession(session, tinycloudHost);
    } catch ({ status, msg }) {
      if (status !== 404) {
        dispatchSDKEvent.error(
          "storage.session_delegation_failed",
          "Failed to submit session key delegation to TinyCloud",
          msg
        );
        throw new Error(
          `Failed to submit session key delegation to TinyCloud: ${msg}`
        );
      }

      if (this.autoCreateNewOrbit === true) {
        await this.showOrbitCreationModal(tcwSession);
        return;
      }
    }

    if (authn) {
      this._orbit = new OrbitConnection(tinycloudHost, authn);

      // Persist the new TinyCloud session
      await this.persistTinyCloudSession(session, tcwSession);
    }
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

      const session: Session = {
        delegationHeader: persistedSession.tinycloudSession.delegationHeader,
        delegationCid: persistedSession.tinycloudSession.delegationCid,
        jwk: JSON.parse(tcwSession.sessionKey),
        namespace: persistedSession.tinycloudSession.namespace,
        orbitId: persistedSession.tinycloudSession.orbitId,
        verificationMethod:
          persistedSession.tinycloudSession.verificationMethod,
      };

      return session;
    } catch (error) {
      console.warn("Failed to load persisted TinyCloud session:", error);
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
        namespace: session.namespace,
        orbitId: session.orbitId,
        verificationMethod: session.verificationMethod,
      };

      if (existingSession) {
        existingSession.tinycloudSession = tinycloudSessionData;
        await this.sessionPersistence.saveSession(existingSession);
      } else {
        const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const newPersistedSession = {
          address: tcwSession.address,
          chainId: tcwSession.chainId,
          sessionKey: tcwSession.sessionKey,
          siwe: tcwSession.siwe,
          signature: tcwSession.signature,
          tinycloudSession: tinycloudSessionData,
          expiresAt: expirationTime,
          createdAt: new Date().toISOString(),
          version: '1.0.0',
        };

        await this.sessionPersistence.saveSession(newPersistedSession);
      }
    } catch (error) {
      console.warn("Failed to persist TinyCloud session:", error);
    }
  }

  get orbit(): OrbitConnection {
    if (!this._orbit) {
      dispatchSDKEvent.error(
        "storage.not_connected",
        "TinyCloudStorage is not connected",
        "Please sign in first to establish a connection"
      );
      throw new Error("TinyCloudStorage is not connected");
    }
    return this._orbit;
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
    return this.orbit.get(`${prefix}/${key}`, request);
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
      const response = await this.orbit.put(
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
    const response = await this.orbit.list(prefix, request);
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
    return this.orbit.delete(`${prefix}/${key}`, request);
  }

  public async deleteAll(prefix?: string): Promise<Response[]> {
    if (prefix) {
      return this.orbit.deleteAll(`${this.prefix}/${prefix}`);
    } else {
      return this.orbit.deleteAll(this.prefix);
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
        this._orbit = new OrbitConnection(tinycloudHost, authn);
      });
      return true;
    } catch (error) {
      if (onError) {
        onError();
      }
      return false;
    }
  }

  private async showOrbitCreationModal(
    tcwSession: TCWClientSession
  ): Promise<void> {
    const result = await showOrbitCreationModal({
      onCreateOrbit: async () => {
        await this.hostOrbit(tcwSession);
        // If we reach here, orbit creation succeeded
        dispatchSDKEvent.success("Orbit created successfully");
      },
      onDismiss: () => {
        // Modal dismissed without creating orbit
        // No further action needed as per requirements
      },
    });

    // Modal completed - either orbit was created or user dismissed
    // In both cases, afterSignIn() can now complete
  }

  public async hostOrbit(tcwSession?: TCWClientSession): Promise<void> {
    const tinycloudHost = this.hosts[0];
    const { status: hostStatus, statusText } = await hostOrbit(
      this.userAuth.getSigner(),
      tinycloudHost,
      `${this.namespace}:${this.orbitId}`,
      this.domain
    );

    if (hostStatus !== 200) {
      dispatchSDKEvent.error(
        "storage.orbit_creation_failed",
        "Failed to open new TinyCloud Orbit",
        statusText
      );
      throw new Error(`Failed to open new TinyCloud Orbit: ${statusText}`);
    }

    const sessionActivated = await this.activateSession(tcwSession, () => {
      dispatchSDKEvent.error(
        "storage.session_not_found",
        "Session not found. You must be signed in to host an orbit"
      );
    });

    if (!sessionActivated) {
      throw new Error(
        "Session not found. You must be signed in to host an orbit"
      );
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
    this.sessionManager.addTargetedActions(this.namespace, target, actions);

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
    const target = `${this.orbitId}/kv/${path}`;
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
    await activateSession(session, tinycloudHost).catch(({ status, msg }) => {
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
      const orbit = new OrbitConnection(tinycloudHost, authn);
      const response = await orbit.get(path);
      return response;
    } catch (error) {
      const { status, msg } = error;
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
