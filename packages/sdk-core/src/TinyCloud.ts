import {
  IUserAuthorization,
  ClientSession,
  Extension,
} from "./userAuthorization";
import {
  ServiceContext,
  IService,
  IServiceContext,
  IKVService,
  KVService,
  ServiceSession,
  InvokeFunction,
  FetchFunction,
  RetryPolicy,
  defaultRetryPolicy,
  ServiceConstructor,
} from "@tinycloud/sdk-services";

/**
 * Configuration for the TinyCloud SDK.
 */
export interface TinyCloudConfig {
  /** Whether to automatically resolve ENS names */
  resolveEns?: boolean;

  // === Service Configuration ===

  /**
   * TinyCloud host URLs.
   * Required when using services.
   */
  hosts?: string[];

  /**
   * Platform-specific invoke function from WASM binding.
   * Required when using services.
   */
  invoke?: InvokeFunction;

  /**
   * Custom fetch implementation.
   * Defaults to globalThis.fetch.
   */
  fetch?: FetchFunction;

  /**
   * Service constructors to register.
   * Built-in services (like KVService) are registered by default unless overridden.
   *
   * @example
   * ```typescript
   * services: {
   *   kv: KVService,  // default
   *   files: MyFileService,  // custom
   * }
   * ```
   */
  services?: Record<string, ServiceConstructor>;

  /**
   * Per-service configuration.
   *
   * @example
   * ```typescript
   * serviceConfigs: {
   *   kv: { prefix: 'myapp' },
   *   files: { maxSize: 10_000_000 },
   * }
   * ```
   */
  serviceConfigs?: Record<string, Record<string, unknown>>;

  /**
   * Retry policy for service operations.
   */
  retryPolicy?: Partial<RetryPolicy>;
}

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
 * import { TinyCloud } from '@tinycloud/sdk-core';
 * import { WebUserAuthorization } from '@tinycloud/web-sdk';
 *
 * const auth = new WebUserAuthorization({ ... });
 * const tc = new TinyCloud(auth);
 * await tc.signIn();
 * const result = await tc.kv.put('key', 'value');
 *
 * // Node usage
 * import { TinyCloud } from '@tinycloud/sdk-core';
 * import { NodeUserAuthorization, PrivateKeySigner } from '@tinycloud/node-sdk';
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
   * SDK configuration.
   */
  private config: TinyCloudConfig;

  /**
   * Registered extensions.
   */
  private extensions: Extension[] = [];

  // === Service Infrastructure ===

  /**
   * Service context providing platform dependencies to services.
   */
  private _serviceContext?: ServiceContext;

  /**
   * Registered services by name.
   */
  private _services: Map<string, IService> = new Map();

  /**
   * Whether services have been initialized.
   */
  private _servicesInitialized: boolean = false;

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

  // === Service Management ===

  /**
   * Initialize services with platform dependencies.
   * Must be called before using services.
   *
   * @param invoke - Platform-specific invoke function from WASM binding
   * @param hosts - TinyCloud host URLs (optional, uses config.hosts)
   * @param fetchFn - Custom fetch implementation (optional)
   */
  public initializeServices(
    invoke?: InvokeFunction,
    hosts?: string[],
    fetchFn?: FetchFunction
  ): void {
    const effectiveInvoke = invoke ?? this.config.invoke;
    const effectiveHosts = hosts ?? this.config.hosts;

    if (!effectiveInvoke) {
      throw new Error(
        "invoke function is required to initialize services. " +
          "Provide it via config.invoke or initializeServices()."
      );
    }

    if (!effectiveHosts || effectiveHosts.length === 0) {
      throw new Error(
        "hosts are required to initialize services. " +
          "Provide them via config.hosts or initializeServices()."
      );
    }

    // Create service context
    this._serviceContext = new ServiceContext({
      invoke: effectiveInvoke,
      fetch: fetchFn ?? this.config.fetch ?? globalThis.fetch.bind(globalThis),
      hosts: effectiveHosts,
      retryPolicy: this.config.retryPolicy,
    });

    // Register default services (can be overridden via config.services)
    const serviceConstructors: Record<string, ServiceConstructor> = {
      kv: KVService,
      ...this.config.services,
    };

    // Create and register services
    for (const [name, ServiceClass] of Object.entries(serviceConstructors)) {
      const serviceConfig = this.config.serviceConfigs?.[name] ?? {};
      const service = new ServiceClass(serviceConfig);
      service.initialize(this._serviceContext);
      this._serviceContext.registerService(name, service);
      this._services.set(name, service);
    }

    this._servicesInitialized = true;
  }

  /**
   * Get the service context.
   * @throws Error if services are not initialized
   */
  public get serviceContext(): IServiceContext {
    if (!this._serviceContext) {
      throw new Error(
        "Services not initialized. Call initializeServices() first."
      );
    }
    return this._serviceContext;
  }

  /**
   * Get a registered service by name.
   *
   * @param name - Service name (e.g., 'kv')
   * @returns The service instance or undefined
   */
  public getService<T extends IService>(name: string): T | undefined {
    return this._services.get(name) as T | undefined;
  }

  /**
   * Get the KV service.
   * @throws Error if services are not initialized
   */
  public get kv(): IKVService {
    if (!this._servicesInitialized) {
      throw new Error(
        "Services not initialized. Call initializeServices() first, " +
          "or use TinyCloudWeb/TinyCloudNode which handles this automatically."
      );
    }
    const service = this._services.get("kv") as IKVService | undefined;
    if (!service) {
      throw new Error("KV service is not registered.");
    }
    return service;
  }

  /**
   * Notify services of session change.
   * Called internally after sign-in and sign-out.
   *
   * @param session - The new session, or null if signed out
   */
  private notifyServicesOfSessionChange(session: ServiceSession | null): void {
    if (this._serviceContext) {
      this._serviceContext.setSession(session);
    }
  }

  /**
   * Abort all pending service operations.
   * Called internally before sign-out.
   */
  private abortServiceOperations(): void {
    if (this._serviceContext) {
      this._serviceContext.abort();
    }
  }

  /**
   * Convert ClientSession to ServiceSession.
   * Returns null if session lacks required fields.
   */
  private toServiceSession(
    clientSession: ClientSession | undefined
  ): ServiceSession | null {
    if (!clientSession) return null;

    // TinyCloudSession contains the required fields
    const tcSession = (clientSession as any).tinycloudSession;
    if (!tcSession) return null;

    return {
      delegationHeader: tcSession.delegationHeader,
      delegationCid: tcSession.delegationCid,
      spaceId: tcSession.spaceId,
      verificationMethod: tcSession.verificationMethod,
      jwk: tcSession.jwk,
    };
  }

  /**
   * Add an extension to the SDK.
   * Extensions can add capabilities and lifecycle hooks.
   */
  public extend(extension: Extension): void {
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
  public get session(): ClientSession | undefined {
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
   * Notifies services of the new session after successful sign-in.
   * @returns The new session
   */
  public async signIn(): Promise<ClientSession> {
    const session = await this.userAuthorization.signIn();

    // Notify services of the new session
    const serviceSession = this.toServiceSession(session);
    this.notifyServicesOfSessionChange(serviceSession);

    return session;
  }

  /**
   * Sign out and clear the current session.
   * Aborts pending service operations and notifies services.
   */
  public async signOut(): Promise<void> {
    // Abort all pending operations before sign-out
    this.abortServiceOperations();

    await this.userAuthorization.signOut();

    // Clear session from services
    this.notifyServicesOfSessionChange(null);
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

}
