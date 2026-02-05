/**
 * Test Utilities for SDK Services
 *
 * Factory functions and helpers for creating test fixtures.
 */

import type { ServiceSession } from "@tinycloud/sdk-services";
import {
  MockServiceContext,
  MockServiceContextConfig,
  MockFetchResponse,
} from "./MockServiceContext";
import { MockKVService, MockKVServiceConfig } from "./MockKVService";

/**
 * Options for creating a test context.
 */
export interface CreateTestContextOptions extends MockServiceContextConfig {
  /** Whether to include a default authenticated session */
  authenticated?: boolean;
  /** Custom session data */
  sessionOverrides?: Partial<ServiceSession>;
}

/**
 * Create a mock ServiceSession for testing.
 *
 * @param overrides - Optional overrides for session fields
 * @returns A mock ServiceSession
 *
 * @example
 * ```typescript
 * const session = createMockSession();
 * const customSession = createMockSession({
 *   spaceId: 'space:custom-id',
 * });
 * ```
 */
export function createMockSession(
  overrides?: Partial<ServiceSession>
): ServiceSession {
  return {
    delegationHeader: {
      Authorization: "Bearer mock-delegation-token",
    },
    delegationCid: "bafy2bzaced5example",
    spaceId: "space:mock-test-space-id",
    verificationMethod: "did:key:z6MkexampleKey#z6MkexampleKey",
    jwk: {
      kty: "OKP",
      crv: "Ed25519",
      x: "mockPublicKeyX",
      d: "mockPrivateKeyD",
    },
    ...overrides,
  };
}

/**
 * Create a MockServiceContext with sensible defaults for testing.
 *
 * @param options - Configuration options
 * @returns A configured MockServiceContext
 *
 * @example
 * ```typescript
 * // Create an authenticated context
 * const context = createTestContext({ authenticated: true });
 *
 * // Create with custom fetch responses
 * const context = createTestContext({
 *   authenticated: true,
 *   fetchResponses: new Map([
 *     ['/invoke', { ok: true, status: 200, body: { data: 'test' } }],
 *   ]),
 * });
 * ```
 */
export function createTestContext(
  options: CreateTestContextOptions = {}
): MockServiceContext {
  const { authenticated = false, sessionOverrides, ...config } = options;

  let session: ServiceSession | null = config.session ?? null;
  if (authenticated && !session) {
    session = createMockSession(sessionOverrides);
  }

  return new MockServiceContext({
    ...config,
    session,
    hosts: config.hosts ?? ["https://mock.tinycloud.test"],
  });
}

/**
 * Create a MockKVService with initial data.
 *
 * @param initialData - Key-value pairs to seed the store
 * @param config - Additional configuration
 * @returns A configured MockKVService
 *
 * @example
 * ```typescript
 * const kv = createMockKV({
 *   'user/settings': { theme: 'dark' },
 *   'user/profile': { name: 'Alice' },
 * });
 *
 * // With latency simulation
 * const kv = createMockKV(
 *   { 'key': 'value' },
 *   { latencyMs: 50 }
 * );
 * ```
 */
export function createMockKV(
  initialData?: Record<string, unknown>,
  config?: Omit<MockKVServiceConfig, "initialData">
): MockKVService {
  return new MockKVService({
    ...config,
    initialData,
  });
}

/**
 * Wait for a specific event to be emitted from a context.
 *
 * @param context - The MockServiceContext to listen on
 * @param eventName - The event name to wait for
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with the event data
 *
 * @example
 * ```typescript
 * // Wait for session change event
 * const eventPromise = waitForEvent(context, 'session.changed');
 * context.setSession(createMockSession());
 * const eventData = await eventPromise;
 * expect(eventData.authenticated).toBe(true);
 * ```
 */
export function waitForEvent(
  context: MockServiceContext,
  eventName: string,
  timeoutMs: number = 5000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeoutMs);

    const unsubscribe = context.on(eventName, (data) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(data);
    });
  });
}

/**
 * Wait for multiple events to be emitted.
 *
 * @param context - The MockServiceContext to listen on
 * @param eventName - The event name to wait for
 * @param count - Number of events to wait for
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise that resolves with array of event data
 *
 * @example
 * ```typescript
 * // Wait for 3 service requests
 * const eventsPromise = waitForEvents(context, 'service.request', 3);
 * await kv.get('key1');
 * await kv.get('key2');
 * await kv.get('key3');
 * const events = await eventsPromise;
 * expect(events).toHaveLength(3);
 * ```
 */
export function waitForEvents(
  context: MockServiceContext,
  eventName: string,
  count: number,
  timeoutMs: number = 5000
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const events: unknown[] = [];

    const timeout = setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          `Timeout waiting for ${count} events of type ${eventName}. Received ${events.length}.`
        )
      );
    }, timeoutMs);

    const unsubscribe = context.on(eventName, (data) => {
      events.push(data);
      if (events.length >= count) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(events);
      }
    });
  });
}

/**
 * Create a mock fetch response for success scenarios.
 *
 * @param body - Response body
 * @param headers - Optional response headers
 * @returns MockFetchResponse
 *
 * @example
 * ```typescript
 * const response = mockOkResponse({ keys: ['a', 'b'] });
 * context.addFetchResponse('/invoke', response);
 * ```
 */
export function mockOkResponse(
  body: unknown,
  headers?: Record<string, string>
): MockFetchResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
  };
}

/**
 * Create a mock fetch response for error scenarios.
 *
 * @param status - HTTP status code
 * @param body - Error body
 * @param statusText - Optional status text
 * @returns MockFetchResponse
 *
 * @example
 * ```typescript
 * const response = mockErrorResponse(404, { error: 'Not found' });
 * context.addFetchResponse('/invoke', response);
 * ```
 */
export function mockErrorResponse(
  status: number,
  body?: unknown,
  statusText?: string
): MockFetchResponse {
  return {
    ok: false,
    status,
    statusText: statusText ?? `Error ${status}`,
    headers: {
      "content-type": "application/json",
    },
    body: body ?? { error: statusText ?? `Error ${status}` },
  };
}

/**
 * Create a delayed mock fetch handler for testing latency.
 *
 * @param response - The response to return after delay
 * @param delayMs - Delay in milliseconds
 * @returns Mock fetch handler function
 *
 * @example
 * ```typescript
 * context.addFetchResponse(
 *   '/invoke',
 *   delayedResponse(mockOkResponse({ data: 'test' }), 100)
 * );
 * ```
 */
export function delayedResponse(
  response: MockFetchResponse,
  delayMs: number
): () => Promise<MockFetchResponse> {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return response;
  };
}

/**
 * Create a sequence of mock responses that cycle through.
 *
 * @param responses - Array of responses to cycle through
 * @returns Mock fetch handler function
 *
 * @example
 * ```typescript
 * // First call returns error, subsequent calls succeed
 * context.addFetchResponse(
 *   '/invoke',
 *   sequenceResponses([
 *     mockErrorResponse(503, 'Temporarily unavailable'),
 *     mockOkResponse({ data: 'success' }),
 *   ])
 * );
 * ```
 */
export function sequenceResponses(
  responses: MockFetchResponse[]
): () => MockFetchResponse {
  let index = 0;
  return () => {
    const response = responses[index];
    if (index < responses.length - 1) {
      index++;
    }
    return response;
  };
}

/**
 * Assert that an operation was recorded with specific properties.
 *
 * @param kv - The MockKVService to check
 * @param expected - Expected operation properties
 * @returns Whether a matching operation was found
 *
 * @example
 * ```typescript
 * await kv.put('key', 'value');
 * expect(wasOperationRecorded(kv, { type: 'put', key: 'key' })).toBe(true);
 * ```
 */
export function wasOperationRecorded(
  kv: MockKVService,
  expected: Partial<{
    type: "get" | "put" | "list" | "delete" | "head";
    key: string;
    value: unknown;
  }>
): boolean {
  return kv.getOperations().some((op) => {
    if (expected.type !== undefined && op.type !== expected.type) return false;
    if (expected.key !== undefined && op.key !== expected.key) return false;
    if (expected.value !== undefined) {
      return JSON.stringify(op.value) === JSON.stringify(expected.value);
    }
    return true;
  });
}

/**
 * Setup a MockKVService with a MockServiceContext.
 *
 * @param kvConfig - MockKVService configuration
 * @param contextConfig - MockServiceContext configuration
 * @returns Object with initialized kv and context
 *
 * @example
 * ```typescript
 * const { kv, context } = setupMockKV(
 *   { initialData: { 'key': 'value' } },
 *   { authenticated: true }
 * );
 *
 * const result = await kv.get('key');
 * expect(result.ok).toBe(true);
 * ```
 */
export function setupMockKV(
  kvConfig?: MockKVServiceConfig,
  contextConfig?: CreateTestContextOptions
): { kv: MockKVService; context: MockServiceContext } {
  const context = createTestContext(contextConfig);
  const kv = new MockKVService(kvConfig);
  kv.initialize(context);
  context.registerService("kv", kv);
  return { kv, context };
}
