/**
 * TinyCloud SDK Services - Test Utilities
 *
 * Mock implementations and test helpers for testing services
 * without network dependencies.
 *
 * @packageDocumentation
 * @module @tinycloud/sdk-services-test
 *
 * @example
 * ```typescript
 * import {
 *   createTestContext,
 *   createMockKV,
 *   createMockSession,
 *   waitForEvent,
 * } from '@tinycloud/sdk-services-test';
 *
 * // Create an authenticated test context
 * const context = createTestContext({ authenticated: true });
 *
 * // Create a mock KV service with seed data
 * const kv = createMockKV({ 'key': 'value' });
 * kv.initialize(context);
 *
 * // Test service operations
 * const result = await kv.get('key');
 * expect(result.ok).toBe(true);
 * ```
 */

// Mock implementations
export {
  MockServiceContext,
  type MockServiceContextConfig,
  type RecordedEvent,
  type MockFetchResponse,
  type MockFetchHandler,
} from "./MockServiceContext";

export {
  MockKVService,
  type MockKVServiceConfig,
  type RecordedOperation,
  type ErrorInjection,
} from "./MockKVService";

// Test helpers
export {
  createMockSession,
  createTestContext,
  createMockKV,
  waitForEvent,
  waitForEvents,
  mockOkResponse,
  mockErrorResponse,
  delayedResponse,
  sequenceResponses,
  wasOperationRecorded,
  setupMockKV,
  type CreateTestContextOptions,
} from "./helpers";
