import {
  IUserAuthorization,
  TCWClientSession,
  TCWExtension,
  TCWEnsData,
  SiweMessage,
  PartialSiweMessage,
} from "./userAuthorization";
import { ITinyCloudStorage, TinyCloudStorageConfig } from "./tinycloudStorage";

/**
 * Configuration for the TinyCloud SDK.
 */
export interface TinyCloudConfig {
  /** Storage configuration */
  storage?: TinyCloudStorageConfig;
  /** Whether to automatically resolve ENS names */
  resolveEns?: boolean;
}

/**
 * Factory function type for creating storage instances.
 * Different platforms provide their own implementation.
 */
export type StorageFactory = (
  config: TinyCloudStorageConfig,
  auth: IUserAuthorization
) => ITinyCloudStorage;

/**
 * TinyCloud SDK - Unified entry point for web and node.
 *
 * This class provides the main SDK interface. Platform-specific behavior
 * is injected through the IUserAuthorization implementation:
 * - WebUserAuthorization for browser environments
 * - NodeUserAuthorization for Node.js environments
 *
 * @example
 * ```typescript
 * // Web usage
 * import { TinyCloud } from '@tinycloudlabs/sdk-core';
 * import { WebUserAuthorization } from '@tinycloudlabs/web-sdk';
 *
 * const auth = new WebUserAuthorization({ ... });
 * const tc = new TinyCloud(auth);
 * await tc.signIn();
 * await tc.storage.put('key', 'value');
 *
 * // Node usage
 * import { TinyCloud } from '@tinycloudlabs/sdk-core';
 * import { NodeUserAuthorization, PrivateKeySigner } from '@tinycloudlabs/node-sdk';
 *
 * const signer = new PrivateKeySigner(process.env.PRIVATE_KEY);
 * const auth = new NodeUserAuthorization({
 *   signStrategy: { type: 'auto-sign' },
 *   signer,
 *   domain: 'api.myapp.com'
 * });
 * const tc = new TinyCloud(auth);
 * await tc.signIn();
 * ```
 */
export class TinyCloud {
  /**
   * User authorization handler.
   * Provides authentication and signing capabilities.
   */
  public readonly userAuthorization: IUserAuthorization;

  /**
   * Storage module.
   * Set after initialization with a storage factory.
   */
  private _storage?: ITinyCloudStorage;

  /**
   * SDK configuration.
   */
  private config: TinyCloudConfig;

  /**
   * Registered extensions.
   */
  private extensions: TCWExtension[] = [];

  /**
   * Create a new TinyCloud SDK instance.
   *
   * @param userAuthorization - Platform-specific authorization implementation
   * @param config - Optional SDK configuration
   */
  constructor(userAuthorization: IUserAuthorization, config?: TinyCloudConfig) {
    this.userAuthorization = userAuthorization;
    this.config = config || {};
  }

  /**
   * Initialize storage with a platform-specific factory.
   * Called by web-sdk or node-sdk during setup.
   *
   * @param factory - Factory function to create storage instance
   */
  public initializeStorage(factory: StorageFactory): void {
    this._storage = factory(
      this.config.storage || {},
      this.userAuthorization
    );

    // Register storage as an extension
    if (this._storage) {
      this.extend(this._storage);
    }
  }

  /**
   * Get the storage module.
   * @throws Error if storage is not initialized
   */
  public get storage(): ITinyCloudStorage {
    if (!this._storage) {
      throw new Error(
        "Storage not initialized. Call initializeStorage() first, " +
          "or use TinyCloudWeb/TinyCloudNode which handles this automatically."
      );
    }
    return this._storage;
  }

  /**
   * Add an extension to the SDK.
   * Extensions can add capabilities and lifecycle hooks.
   */
  public extend(extension: TCWExtension): void {
    this.extensions.push(extension);
    this.userAuthorization.extend(extension);
  }

  /**
   * Check if an extension is enabled.
   * @param namespace - The extension namespace to check
   */
  public isExtensionEnabled(namespace: string): boolean {
    return this.extensions.some((ext) => ext.namespace === namespace);
  }

  // === Authentication Methods (delegate to userAuthorization) ===

  /**
   * Get the current session, if signed in.
   */
  public get session(): TCWClientSession | undefined {
    return this.userAuthorization.session;
  }

  /**
   * Check if the user is signed in.
   */
  public get isSignedIn(): boolean {
    return !!this.userAuthorization.session;
  }

  /**
   * Sign in and create a new session.
   * @returns The new session
   */
  public async signIn(): Promise<TCWClientSession> {
    return this.userAuthorization.signIn();
  }

  /**
   * Sign out and clear the current session.
   */
  public async signOut(): Promise<void> {
    return this.userAuthorization.signOut();
  }

  /**
   * Get the current wallet address.
   */
  public address(): string | undefined {
    return this.userAuthorization.address();
  }

  /**
   * Get the current chain ID.
   */
  public chainId(): number | undefined {
    return this.userAuthorization.chainId();
  }

  /**
   * Sign a message with the connected wallet.
   * @param message - Message to sign
   */
  public async signMessage(message: string): Promise<string> {
    return this.userAuthorization.signMessage(message);
  }

  /**
   * Generate a SIWE message for custom flows.
   */
  public async generateSiweMessage(
    address: string,
    partial?: PartialSiweMessage
  ): Promise<SiweMessage> {
    return this.userAuthorization.generateSiweMessage(address, partial);
  }

  /**
   * Complete sign-in with a pre-signed message.
   */
  public async signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<TCWClientSession> {
    return this.userAuthorization.signInWithSignature(siweMessage, signature);
  }

  /**
   * Try to resume a previously persisted session.
   */
  public async tryResumeSession(
    address: string
  ): Promise<TCWClientSession | null> {
    return this.userAuthorization.tryResumeSession(address);
  }

  /**
   * Clear persisted session data.
   */
  public async clearPersistedSession(address?: string): Promise<void> {
    return this.userAuthorization.clearPersistedSession(address);
  }

  /**
   * Check if a session is persisted for an address.
   */
  public isSessionPersisted(address: string): boolean {
    return this.userAuthorization.isSessionPersisted(address);
  }
}
