/**
 * MockServiceContext - Test implementation of IServiceContext
 *
 * Provides a configurable mock context for testing services
 * without network dependencies.
 */

import type {
  IServiceContext,
  IService,
  ServiceSession,
  RetryPolicy,
  InvokeFunction,
  FetchFunction,
  FetchResponse,
  FetchRequestInit,
  EventHandler,
  ServiceHeaders,
} from "@tinycloudlabs/sdk-services";

/**
 * Recorded event with timestamp for assertion.
 */
export interface RecordedEvent {
  event: string;
  data: unknown;
  timestamp: number;
}

/**
 * Mock fetch response configuration.
 */
export interface MockFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Mock fetch handler type.
 * Can return a response directly or a function for dynamic responses.
 */
export type MockFetchHandler =
  | MockFetchResponse
  | ((url: string, init?: FetchRequestInit) => MockFetchResponse | Promise<MockFetchResponse>);

/**
 * Configuration for MockServiceContext.
 */
export interface MockServiceContextConfig {
  /** Initial session state */
  session?: ServiceSession | null;
  /** List of host URLs */
  hosts?: string[];
  /** Custom invoke function */
  invoke?: InvokeFunction;
  /** Default mock fetch responses by URL pattern */
  fetchResponses?: Map<string | RegExp, MockFetchHandler>;
  /** Default response for unmatched URLs */
  defaultFetchResponse?: MockFetchResponse;
  /** Retry policy configuration */
  retryPolicy?: RetryPolicy;
}

/**
 * MockServiceContext implements IServiceContext for testing.
 *
 * Features:
 * - In-memory service registry
 * - Configurable mock invoke that returns test data
 * - Configurable mock fetch with pattern matching
 * - Event emission tracking for assertions
 * - Session state management
 *
 * @example
 * ```typescript
 * const context = new MockServiceContext({
 *   session: createMockSession(),
 *   fetchResponses: new Map([
 *     ['/invoke', { ok: true, status: 200, body: { data: 'test' } }],
 *   ]),
 * });
 *
 * const kv = new KVService({});
 * kv.initialize(context);
 * context.registerService('kv', kv);
 *
 * // Assert events were emitted
 * expect(context.getEmittedEvents('service.request')).toHaveLength(1);
 * ```
 */
export class MockServiceContext implements IServiceContext {
  private _session: ServiceSession | null;
  private _services: Map<string, IService> = new Map();
  private _eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private _emittedEvents: RecordedEvent[] = [];
  private _abortController: AbortController = new AbortController();
  private _fetchResponses: Map<string | RegExp, MockFetchHandler>;
  private _defaultFetchResponse: MockFetchResponse;
  private _invokeCallCount: number = 0;
  private _fetchCallCount: number = 0;
  private _invokeFunction: InvokeFunction;

  readonly hosts: string[];
  readonly retryPolicy: RetryPolicy;

  constructor(config: MockServiceContextConfig = {}) {
    this._session = config.session ?? null;
    this.hosts = config.hosts ?? ["https://mock.tinycloud.test"];
    this._fetchResponses = config.fetchResponses ?? new Map();
    this._defaultFetchResponse = config.defaultFetchResponse ?? {
      ok: true,
      status: 200,
      statusText: "OK",
      body: {},
    };
    this._invokeFunction = config.invoke ?? this.defaultInvoke.bind(this);
    this.retryPolicy = config.retryPolicy ?? {
      maxAttempts: 3,
      backoff: "exponential",
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      retryableErrors: ["NETWORK_ERROR", "TIMEOUT"],
    };
  }

  // ============================================================
  // Session Management
  // ============================================================

  get session(): ServiceSession | null {
    return this._session;
  }

  get isAuthenticated(): boolean {
    return this._session !== null;
  }

  /**
   * Set the session (test helper).
   */
  setSession(session: ServiceSession | null): void {
    this._session = session;
    this.emit("session.changed", { authenticated: session !== null });

    for (const service of this._services.values()) {
      service.onSessionChange(session);
    }
  }

  // ============================================================
  // Platform Dependencies
  // ============================================================

  /**
   * Default invoke implementation that returns mock headers.
   */
  private defaultInvoke(
    session: ServiceSession,
    service: string,
    path: string,
    action: string
  ): ServiceHeaders {
    return {
      Authorization: `Bearer mock-token-${service}-${action}`,
      "X-Mock-Service": service,
      "X-Mock-Path": path,
      "X-Mock-Action": action,
    };
  }

  get invoke(): InvokeFunction {
    return (
      session: ServiceSession,
      service: string,
      path: string,
      action: string
    ): ServiceHeaders => {
      this._invokeCallCount++;
      return this._invokeFunction(session, service, path, action);
    };
  }

  get fetch(): FetchFunction {
    return async (url: string, init?: FetchRequestInit): Promise<FetchResponse> => {
      this._fetchCallCount++;

      // Find matching response
      let mockResponse = this._defaultFetchResponse;
      for (const [pattern, handler] of this._fetchResponses) {
        const matches =
          typeof pattern === "string"
            ? url.includes(pattern)
            : pattern.test(url);

        if (matches) {
          if (typeof handler === "function") {
            mockResponse = await handler(url, init);
          } else {
            mockResponse = handler;
          }
          break;
        }
      }

      // Create mock response object
      const headers = new Map(
        Object.entries(mockResponse.headers ?? {}).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ])
      );

      return {
        ok: mockResponse.ok,
        status: mockResponse.status,
        statusText: mockResponse.statusText,
        headers: {
          get: (name: string) => headers.get(name.toLowerCase()) ?? null,
        },
        json: async () => mockResponse.body,
        text: async () =>
          typeof mockResponse.body === "string"
            ? mockResponse.body
            : JSON.stringify(mockResponse.body),
      };
    };
  }

  // ============================================================
  // Service Registry
  // ============================================================

  registerService(name: string, service: IService): void {
    this._services.set(name, service);
  }

  unregisterService(name: string): void {
    this._services.delete(name);
  }

  getService<T extends IService>(name: string): T | undefined {
    return this._services.get(name) as T | undefined;
  }

  // ============================================================
  // Event System (Telemetry)
  // ============================================================

  emit(event: string, data: unknown): void {
    // Record the event for assertions
    this._emittedEvents.push({
      event,
      data,
      timestamp: Date.now(),
    });

    // Notify handlers
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // Swallow errors in handlers during tests
        }
      }
    }
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);

    return () => {
      const handlers = this._eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this._eventHandlers.delete(event);
        }
      }
    };
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  get abortSignal(): AbortSignal {
    return this._abortController.signal;
  }

  /**
   * Abort all operations (test helper).
   */
  abort(): void {
    this._abortController.abort();
    this._abortController = new AbortController();

    for (const service of this._services.values()) {
      service.onSignOut();
    }
  }

  // ============================================================
  // Test Assertion Helpers
  // ============================================================

  /**
   * Get all emitted events.
   */
  getEmittedEvents(): RecordedEvent[] {
    return [...this._emittedEvents];
  }

  /**
   * Get emitted events filtered by event name.
   */
  getEmittedEventsByName(eventName: string): RecordedEvent[] {
    return this._emittedEvents.filter((e) => e.event === eventName);
  }

  /**
   * Check if a specific event was emitted.
   */
  wasEventEmitted(eventName: string): boolean {
    return this._emittedEvents.some((e) => e.event === eventName);
  }

  /**
   * Get the count of events by name.
   */
  getEventCount(eventName: string): number {
    return this._emittedEvents.filter((e) => e.event === eventName).length;
  }

  /**
   * Clear all recorded events.
   */
  clearEmittedEvents(): void {
    this._emittedEvents = [];
  }

  /**
   * Get the number of invoke calls.
   */
  get invokeCallCount(): number {
    return this._invokeCallCount;
  }

  /**
   * Get the number of fetch calls.
   */
  get fetchCallCount(): number {
    return this._fetchCallCount;
  }

  /**
   * Reset call counts.
   */
  resetCallCounts(): void {
    this._invokeCallCount = 0;
    this._fetchCallCount = 0;
  }

  /**
   * Add a mock fetch response for a URL pattern.
   */
  addFetchResponse(pattern: string | RegExp, response: MockFetchHandler): void {
    this._fetchResponses.set(pattern, response);
  }

  /**
   * Remove a mock fetch response.
   */
  removeFetchResponse(pattern: string | RegExp): void {
    this._fetchResponses.delete(pattern);
  }

  /**
   * Clear all mock fetch responses.
   */
  clearFetchResponses(): void {
    this._fetchResponses.clear();
  }

  /**
   * Set the default fetch response.
   */
  setDefaultFetchResponse(response: MockFetchResponse): void {
    this._defaultFetchResponse = response;
  }
}
