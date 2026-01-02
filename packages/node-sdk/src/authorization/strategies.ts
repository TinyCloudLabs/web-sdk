import { EventEmitter } from "events";

/**
 * Sign request passed to callback or event handlers.
 */
export interface SignRequest {
  /** Ethereum address of the signer */
  address: string;
  /** Chain ID for the signing context */
  chainId: number;
  /** Message to be signed */
  message: string;
  /** Type of sign operation */
  type: "siwe" | "message";
}

/**
 * Sign response from callback or event handlers.
 */
export interface SignResponse {
  /** Whether the sign request was approved */
  approved: boolean;
  /** The signature if approved */
  signature?: string;
  /** Reason for rejection if not approved */
  reason?: string;
}

/**
 * Callback handler type for sign requests.
 */
export type SignCallback = (request: SignRequest) => Promise<SignResponse>;

/**
 * Auto-sign strategy: automatically signs all requests.
 *
 * Use cases:
 * - Trusted backend services
 * - Automated scripts
 * - CI/CD pipelines
 *
 * @example
 * ```typescript
 * const strategy: AutoSignStrategy = { type: 'auto-sign' };
 * ```
 */
export interface AutoSignStrategy {
  type: "auto-sign";
}

/**
 * Auto-reject strategy: rejects all sign requests.
 *
 * Use cases:
 * - Read-only applications
 * - Testing rejection flows
 *
 * @example
 * ```typescript
 * const strategy: AutoRejectStrategy = { type: 'auto-reject' };
 * ```
 */
export interface AutoRejectStrategy {
  type: "auto-reject";
}

/**
 * Callback strategy: delegates sign decisions to a callback function.
 *
 * Use cases:
 * - CLI applications with user prompts
 * - Custom approval workflows
 * - Interactive sign flows
 *
 * @example
 * ```typescript
 * const strategy: CallbackStrategy = {
 *   type: 'callback',
 *   handler: async (req) => {
 *     const approved = await promptUser(`Sign message for ${req.address}?`);
 *     return { approved, signature: approved ? await signer.sign(req.message) : undefined };
 *   }
 * };
 * ```
 */
export interface CallbackStrategy {
  type: "callback";
  handler: SignCallback;
}

/**
 * Event emitter strategy: emits sign requests as events.
 *
 * Events emitted:
 * - 'sign-request': When a sign request is received
 *
 * Use cases:
 * - Async approval workflows
 * - External signing services
 * - Multi-step authorization flows
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter();
 * const strategy: EventEmitterStrategy = { type: 'event-emitter', emitter };
 *
 * emitter.on('sign-request', async (req, respond) => {
 *   const approved = await externalApprovalService.check(req);
 *   respond({ approved, signature: approved ? await sign(req.message) : undefined });
 * });
 * ```
 */
export interface EventEmitterStrategy {
  type: "event-emitter";
  emitter: EventEmitter;
  /** Timeout in milliseconds for waiting on event response (default: 60000) */
  timeout?: number;
}

/**
 * Sign strategy union type.
 *
 * Determines how sign requests are handled in NodeUserAuthorization.
 */
export type SignStrategy =
  | AutoSignStrategy
  | AutoRejectStrategy
  | CallbackStrategy
  | EventEmitterStrategy;

/**
 * Default sign strategy is auto-sign for convenience.
 */
export const defaultSignStrategy: SignStrategy = { type: "auto-sign" };
