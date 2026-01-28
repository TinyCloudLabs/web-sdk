/**
 * Web-specific space creation handler using modal.
 *
 * @packageDocumentation
 */

import {
  ISpaceCreationHandler,
  SpaceCreationContext,
} from "@tinycloudlabs/sdk-core";
import { showSpaceCreationModal } from "../notifications/ModalManager";
import { dispatchSDKEvent } from "../notifications/ErrorHandler";

/**
 * Space creation handler that shows a modal for user confirmation.
 *
 * This is the default handler for web applications, providing a
 * user-friendly confirmation dialog before creating a new space.
 *
 * @example
 * ```typescript
 * const auth = new WebUserAuthorization({
 *   provider: window.ethereum,
 *   spaceCreationHandler: new ModalSpaceCreationHandler(),
 * });
 * ```
 */
export class ModalSpaceCreationHandler implements ISpaceCreationHandler {
  /**
   * Show a modal to confirm space creation.
   * Returns true if user confirms, false if dismissed.
   */
  async confirmSpaceCreation(context: SpaceCreationContext): Promise<boolean> {
    return new Promise((resolve) => {
      showSpaceCreationModal({
        onCreateSpace: async () => {
          // Just resolve true - actual creation happens in WebUserAuthorization
          resolve(true);
        },
        onDismiss: () => {
          resolve(false);
        },
      });
    });
  }

  /**
   * Show success notification after space creation.
   */
  onSpaceCreated(context: SpaceCreationContext): void {
    dispatchSDKEvent.success("TinyCloud Space created successfully");
  }

  /**
   * Show error notification if space creation fails.
   */
  onSpaceCreationFailed(context: SpaceCreationContext, error: Error): void {
    dispatchSDKEvent.error(
      "storage.space_creation_failed",
      "Failed to create your TinyCloud Space",
      error.message
    );
  }
}

/**
 * Default web space creation handler using modal confirmation.
 */
export const defaultWebSpaceCreationHandler: ISpaceCreationHandler =
  new ModalSpaceCreationHandler();
