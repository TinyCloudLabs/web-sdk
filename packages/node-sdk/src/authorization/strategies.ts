/**
 * Node.js-specific SignStrategy types for TinyCloud authorization.
 *
 * This module re-exports common types from sdk-core and provides
 * Node.js-specific implementations (e.g., NodeEventEmitterStrategy
 * using Node's EventEmitter instead of browser EventTarget).
 *
 * @packageDocumentation
 */

import { EventEmitter } from "events";

// Re-export common types from sdk-core
export {
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
} from "@tinycloudlabs/sdk-core";

// Import types for use in local definitions
import type {
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
} from "@tinycloudlabs/sdk-core";

/**
 * Node.js event emitter strategy: emits sign requests as events.
 *
 * Uses Node.js EventEmitter for compatibility with Node.js applications.
 * For browser environments, use the EventEmitterStrategy from sdk-core
 * which uses EventTarget.
 *
 * Events emitted:
 * - 'sign-request': When a sign request is received
 *
 * Use cases:
 * - Async approval workflows in Node.js
 * - External signing services
 * - Multi-step authorization flows
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter();
 * const strategy: NodeEventEmitterStrategy = { type: 'event-emitter', emitter };
 *
 * emitter.on('sign-request', async (req, respond) => {
 *   const approved = await externalApprovalService.check(req);
 *   respond({ approved, signature: approved ? await sign(req.message) : undefined });
 * });
 * ```
 */
export interface NodeEventEmitterStrategy {
  type: "event-emitter";
  emitter: EventEmitter;
  /** Timeout in milliseconds for waiting on event response (default: 60000) */
  timeout?: number;
}

/**
 * Alias for backwards compatibility.
 * @deprecated Use NodeEventEmitterStrategy instead
 */
export type EventEmitterStrategy = NodeEventEmitterStrategy;

/**
 * Node.js sign strategy union type.
 *
 * Determines how sign requests are handled in NodeUserAuthorization.
 * Uses Node.js EventEmitter for the event-emitter strategy.
 */
export type SignStrategy =
  | AutoSignStrategy
  | AutoRejectStrategy
  | CallbackStrategy
  | NodeEventEmitterStrategy;

/**
 * Default sign strategy is auto-sign for convenience.
 * This is the Node.js-specific version typed with SignStrategy.
 */
export const defaultSignStrategy: SignStrategy = { type: "auto-sign" };
