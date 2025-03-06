import { initialized, kepler, tcwSession } from '@tinycloudlabs/web-sdk-wasm';
import { ConfigOverrides, TCWClientSession } from '@tinycloudlabs/web-core/client';
import { generateNonce, SiweMessage } from 'siwe';
import {
  OrbitConnection,
  activateSession,
  hostOrbit,
  Response,
  Session,
} from './kepler';
import {
  IStorage,
  IKepler,
  IStorageListOptions,
  IStoragePutOptions,
  IStorageGetOptions,
  IStorageDeleteOptions,
} from './interfaces';
import {
  IUserAuthorization,
  UserAuthorizationConnected,
} from '../../';

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
 * KeplerStorage provides decentralized storage functionality through the Kepler protocol.
 * This class implements both the IStorage and IKepler interfaces.
 * 
 * @remarks
 * KeplerStorage allows for storing, retrieving, and managing data in a decentralized way.
 * It handles authentication and session management for secure data operations.
 * 
 * @public
 */
export class KeplerStorage implements IStorage, IKepler {
  /**
   * The namespace identifier for Kepler storage.
   * @public
   */
  public namespace = 'kepler';
  
  /**
   * The prefix used for all storage operations.
   * @public
   */
  public prefix: string;
  
  /**
   * Array of Kepler host endpoints.
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
   * Reference to the Kepler WASM module.
   * @private
   */
  private keplerModule?: any;
  
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
   * Creates a new instance of the KeplerStorage class.
   * 
   * @param config - Configuration options for Kepler storage
   * @param config.hosts - Optional array of Kepler host endpoints
   * @param config.prefix - Optional prefix to use for all storage operations
   * @param config.autoCreateNewOrbit - Whether to automatically create a new orbit if one doesn't exist
   * @param userAuth - User authorization interface for authentication
   * 
   * @public
   */
  constructor(config: any, userAuth: IUserAuthorization) {
    this.userAuth = userAuth;
    this.hosts = [...(config?.hosts || []), 'https://node.tinycloud.xyz'];
    this.prefix = config?.prefix || '';
    this.autoCreateNewOrbit =
      config?.autoCreateNewOrbit === undefined
        ? true
        : config?.autoCreateNewOrbit;
  }

  public async afterConnect(
    tcw: UserAuthorizationConnected
  ): Promise<ConfigOverrides> {
    await initialized;
    this.keplerModule = await kepler;
    this.sessionManager = new (await tcwSession).TCWSessionManager();
    (global as any).keplerModule = this.keplerModule;

    const address = await tcw.provider.getSigner().getAddress();
    const chain = await tcw.provider.getSigner().getChainId();

    this.orbitId = `kepler:pkh:eip155:${chain}:${address}://default`;

    this.domain = tcw.config.siweConfig?.domain;
    return {};
  }

  public async targetedActions(): Promise<{ [target: string]: string[] }> {
    const actions = {};
    actions[`${this.orbitId}/capabilities/`] = ['read'];
    actions[`${this.orbitId}/kv/${this.prefix}`] = [
      'put',
      'get',
      'list',
      'del',
      'metadata',
    ];
    return actions;
  }

  public async generateKeplerSession(
    tcwSession: TCWClientSession
  ): Promise<Session> {
    return await Promise.resolve({
      jwk: JSON.parse(tcwSession.sessionKey),
      orbitId: this.orbitId,
      service: 'kv',
      siwe: tcwSession.siwe,
      signature: tcwSession.signature,
      verificationMethod: new SiweMessage(tcwSession.siwe).uri,
    })
      .then(JSON.stringify)
      // @TODO: figure out unit test issue
      .then(this.keplerModule.completeSessionSetup)
      .then(JSON.parse);
  }

  public async afterSignIn(tcwSession: TCWClientSession): Promise<void> {
    const keplerHost = this.hosts[0];
    const session = await this.generateKeplerSession(tcwSession);

    let authn;
    try {
      authn = await activateSession(session, keplerHost);
    } catch ({ status, msg }) {
      if (status !== 404) {
        throw new Error(
          `Failed to submit session key delegation to Kepler: ${msg}`
        );
      }

      if (this.autoCreateNewOrbit === true) {
        await this.hostOrbit(tcwSession);
        return;
      }
    }

    if (authn) {
      this._orbit = new OrbitConnection(keplerHost, authn);
    }
  }

  get orbit(): OrbitConnection {
    if (!this._orbit) {
      throw new Error('KeplerStorage is not connected');
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
   * const response = await keplerStorage.get('myData');
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
   * await keplerStorage.put('myData', data);
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
    return this.orbit.put(`${prefix || this.prefix}/${key}`, value, request);
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
   * const response = await keplerStorage.list({ 
   *   path: 'folder', 
   *   removePrefix: true 
   * });
   * console.log(response.data); // List of keys
   * ```
   * 
   * @public
   */
  public async list(
    options: IStorageListOptions = {}
  ): Promise<Response> {
    const defaultOptions = {
      prefix: this.prefix,
      removePrefix: false,
    };
    const { prefix, path, request, removePrefix } = { ...defaultOptions, ...options };
    const p = path ? `${prefix}/${path}` : `${prefix}/`;
    const response = await this.orbit.list(prefix, request);
    // remove prefix from keys
    return removePrefix
      ? { ...response, data: response.data.map(key => key.slice(p.length)) }
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
   * await keplerStorage.delete('myData');
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

      const session = await this.generateKeplerSession(tcwSession);

      const keplerHost = this.hosts[0];
      await activateSession(session, keplerHost).then(authn => {
        this._orbit = new OrbitConnection(keplerHost, authn);
      });
      return true;
    } catch (error) {
      onError?.();
      return false;
    }
  }

  public async hostOrbit(tcwSession?: TCWClientSession): Promise<void> {
    const keplerHost = this.hosts[0];
    const { status: hostStatus, statusText } = await hostOrbit(
      this.userAuth.getSigner(),
      keplerHost,
      this.orbitId,
      this.domain
    );

    if (hostStatus !== 200) {
      throw new Error(`Failed to open new Kepler Orbit: ${statusText}`);
    }

    await this.activateSession(tcwSession, () => {
      throw new Error(
        'Session not found. You must be signed in to host an orbit'
      );
    });
  }

  public async delegate({
    target,
    delegateDID,
    actions,
    statement,
  }: DelegateParams): Promise<DelegateResponse> {
    // add actions to session builder
    this.sessionManager.resetBuilder();
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
    const actions = ['get', 'metadata'];

    // delegate permission to target
    const { siwe, signature } = await this.delegate({
      target,
      delegateDID,
      actions,
      statement: 'I am giving permission to read this data.',
    });

    // create tcw + kepler session
    const sessionData: TCWClientSession = {
      address: this.userAuth.address(),
      walletAddress: this.userAuth.address(),
      chainId: this.userAuth.chainId(),
      sessionKey,
      siwe,
      signature,
    };

    const session = await this.generateKeplerSession(sessionData);
    /* activate session */
    const keplerHost = this.hosts[0];
    await activateSession(session, keplerHost).catch(({ status, msg }) => {
      if (status !== 404) {
        throw new Error(
          `Failed to submit session key delegation to Kepler: ${msg}`
        );
      }
    });
    /* end activate session */

    // store session with key
    // bundle delegation and encode
    const shareData = {
      path,
      keplerHost: this.hosts[0],
      session,
    };

    const shareJSON = JSON.stringify(shareData);
    const shareBase64 = btoa(shareJSON);
    return shareBase64;
  }

  public async retrieveSharingLink(encodedShare: string): Promise<Response> {
    (global as any).keplerModule = await kepler;

    // read key and delegation bundle
    const shareJSON = atob(encodedShare);
    const { path, keplerHost, session } = JSON.parse(shareJSON);

    // activate session and retrieve data
    try {
      const authn = await activateSession(session, keplerHost);
      const orbit = new OrbitConnection(keplerHost, authn);
      const response = await orbit.get(path);
      return response;
    } catch (error) {
      const { status, msg } = error;
      if (status !== 404) {
        throw new Error(
          `Failed to submit session key delegation to Kepler: ${msg}`
        );
      }
    }
  }
}

export default KeplerStorage;
