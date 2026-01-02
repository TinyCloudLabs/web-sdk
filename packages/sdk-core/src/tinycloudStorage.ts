import { TCWExtension, TCWClientSession } from "./userAuthorization";

/**
 * Base options for storage operations.
 */
export interface StorageBaseOptions {
  /** Optional prefix/folder path */
  prefix?: string;
}

/**
 * Options for get operations.
 */
export interface StorageGetOptions extends StorageBaseOptions {}

/**
 * Options for put operations.
 */
export interface StoragePutOptions extends StorageBaseOptions {}

/**
 * Options for delete operations.
 */
export interface StorageDeleteOptions extends StorageBaseOptions {}

/**
 * Options for list operations.
 */
export interface StorageListOptions extends StorageBaseOptions {
  /** Optional path to combine with prefix */
  path?: string;
  /** Whether to remove prefix from returned keys */
  removePrefix?: boolean;
}

/**
 * Response from storage operations.
 */
export interface StorageResponse<T = unknown> {
  /** Whether the operation succeeded */
  ok: boolean;
  /** HTTP status code */
  status: number;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
}

/**
 * TinyCloud storage configuration.
 */
export interface TinyCloudStorageConfig {
  /** TinyCloud host endpoints */
  hosts?: string[];
  /** Default prefix for all operations */
  prefix?: string;
  /** Automatically create namespace if not exists */
  autoCreateNewNamespace?: boolean;
  /** Domain for SIWE messages */
  domain?: string;
}

/**
 * Delegate parameters for sharing.
 */
export interface DelegateParams {
  /** Target file or folder path */
  target: string;
  /** DID of the delegate */
  delegateDID: string;
  /** Actions to authorize */
  actions: string[];
  /** Optional SIWE statement */
  statement?: string;
}

/**
 * Delegate response.
 */
export interface DelegateResponse {
  /** SIWE message content */
  siwe: string;
  /** Signature */
  signature: string;
  /** Delegation version */
  version: number;
}

/**
 * Platform-agnostic storage interface.
 *
 * Defines the core storage operations that both web and node SDKs implement.
 */
export interface ITinyCloudStorage extends TCWExtension {
  /** The namespace ID for this storage instance */
  namespaceId?: string;

  /**
   * Get a value by key.
   * @param key - The key to retrieve
   * @param options - Optional get options
   */
  get(key: string, options?: StorageGetOptions): Promise<StorageResponse>;

  /**
   * Store a value.
   * @param key - The key to store under
   * @param value - The value to store
   * @param options - Optional put options
   */
  put(
    key: string,
    value: unknown,
    options?: StoragePutOptions
  ): Promise<StorageResponse>;

  /**
   * List keys in storage.
   * @param options - Optional list options
   */
  list(options?: StorageListOptions): Promise<StorageResponse<string[]>>;

  /**
   * Delete a key.
   * @param key - The key to delete
   * @param options - Optional delete options
   */
  delete(key: string, options?: StorageDeleteOptions): Promise<StorageResponse>;

  /**
   * Delete all keys (optionally under a prefix).
   * @param prefix - Optional prefix to limit deletion
   */
  deleteAll(prefix?: string): Promise<StorageResponse[]>;

  /**
   * Activate the storage session.
   * @param session - The client session
   * @param onError - Optional error callback
   */
  activateSession(
    session?: TCWClientSession,
    onError?: () => void
  ): Promise<boolean>;

  /**
   * Host a namespace (register as a host).
   * @param session - Optional client session
   */
  hostNamespace(session?: TCWClientSession): Promise<void>;

  /**
   * Generate a sharing link for a key.
   * @param key - The key to share
   * @param params - Optional delegate params
   */
  generateSharingLink(key: string, params?: DelegateParams): Promise<string>;

  /**
   * Retrieve data from a sharing link.
   * @param link - The sharing link
   */
  retrieveSharingLink(link: string): Promise<StorageResponse>;

  /**
   * Create a delegation.
   * @param params - Delegation parameters
   */
  delegate(params: DelegateParams): Promise<DelegateResponse>;
}
