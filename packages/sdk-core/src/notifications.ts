/**
 * Notification handler interface for TinyCloud SDK.
 *
 * Abstracts UI notifications so that web-sdk can show toasts
 * while node-sdk uses a silent no-op handler.
 *
 * @packageDocumentation
 */

/**
 * Platform-agnostic notification handler.
 *
 * Implementations can provide different UX patterns:
 * - Browser: toast notifications via antd or similar
 * - Node.js: silent (default) or logging
 * - CLI: console output
 */
export interface INotificationHandler {
  /** Called on successful operations (e.g., "Successfully signed in") */
  success(message: string, description?: string): void;
  /** Called on warnings */
  warning(message: string, description?: string): void;
  /** Called on errors */
  error(category: string, message: string, description?: string): void;
  /** Optional cleanup (e.g., dismiss all active notifications) */
  cleanup?(): void;
}

/** No-op handler for environments without UI (node-sdk default). */
export class SilentNotificationHandler implements INotificationHandler {
  success(): void {}
  warning(): void {}
  error(): void {}
}
