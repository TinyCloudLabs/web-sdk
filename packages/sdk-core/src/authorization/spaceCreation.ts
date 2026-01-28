/**
 * Space creation handler types for TinyCloud authorization.
 *
 * These types abstract space creation confirmation, allowing different
 * implementations for web (modal) vs node (auto-approve) environments.
 *
 * @packageDocumentation
 */

/**
 * Context passed to space creation handlers.
 */
export interface SpaceCreationContext {
  /** The unique identifier for the space being created */
  spaceId: string;
  /** Ethereum address of the user creating the space */
  address: string;
  /** Chain ID for the creation context */
  chainId: number;
  /** Host URL where the space will be created */
  host: string;
}

/**
 * Interface for handling space creation confirmation.
 *
 * Implementations can provide different UX patterns:
 * - Auto-approve for backend services
 * - Modal confirmation for web apps
 * - CLI prompts for terminal apps
 *
 * @example
 * ```typescript
 * class ModalSpaceCreationHandler implements ISpaceCreationHandler {
 *   async confirmSpaceCreation(context: SpaceCreationContext): Promise<boolean> {
 *     return await showConfirmationModal(`Create space ${context.spaceId}?`);
 *   }
 *
 *   onSpaceCreated(context: SpaceCreationContext): void {
 *     showToast(`Space ${context.spaceId} created!`);
 *   }
 *
 *   onSpaceCreationFailed(context: SpaceCreationContext, error: Error): void {
 *     showErrorModal(`Failed to create space: ${error.message}`);
 *   }
 * }
 * ```
 */
export interface ISpaceCreationHandler {
  /**
   * Called when a new space needs to be created.
   * Returns true if space should be created, false to skip.
   *
   * @param context - Information about the space to be created
   * @returns Promise resolving to true to proceed, false to cancel
   */
  confirmSpaceCreation(context: SpaceCreationContext): Promise<boolean>;

  /**
   * Called after successful space creation.
   * Optional - implement to show success UI or perform cleanup.
   *
   * @param context - Information about the created space
   */
  onSpaceCreated?(context: SpaceCreationContext): void;

  /**
   * Called if space creation fails.
   * Optional - implement to show error UI or perform recovery.
   *
   * @param context - Information about the space that failed to create
   * @param error - The error that occurred
   */
  onSpaceCreationFailed?(context: SpaceCreationContext, error: Error): void;
}

/**
 * Default handler that auto-approves all space creation.
 *
 * Use cases:
 * - Backend services
 * - Automated scripts
 * - Node.js applications without UI
 *
 * @example
 * ```typescript
 * const handler = new AutoApproveSpaceCreationHandler();
 * const config = { spaceCreationHandler: handler };
 * ```
 */
export class AutoApproveSpaceCreationHandler implements ISpaceCreationHandler {
  /**
   * Always returns true to auto-approve space creation.
   */
  async confirmSpaceCreation(): Promise<boolean> {
    return true;
  }
}

/**
 * Default space creation handler that auto-approves all requests.
 */
export const defaultSpaceCreationHandler: ISpaceCreationHandler =
  new AutoApproveSpaceCreationHandler();
