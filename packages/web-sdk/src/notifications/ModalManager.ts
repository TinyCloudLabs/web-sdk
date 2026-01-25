import { TinyCloudSpaceModal, type SpaceCreationModalOptions, type SpaceCreationResult } from './SpaceCreationModal';
import { TinyCloudNodeSelectionModal, type NodeSelectionModalOptions, type NodeSelectionResult } from './NodeSelectionModal';

export class ModalManager {
  private static instance: ModalManager;
  private activeModal: TinyCloudSpaceModal | TinyCloudNodeSelectionModal | null = null;

  private constructor() { }

  public static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  public showSpaceCreationModal(options: SpaceCreationModalOptions): Promise<SpaceCreationResult> {
    // Close any existing modal first
    this.closeActiveModal();

    // Create and show new modal
    const modal = new TinyCloudSpaceModal({
      ...options,
      onDismiss: () => {
        this.activeModal = null;
        options.onDismiss?.();
      }
    });

    // Add to DOM
    document.body.appendChild(modal);
    this.activeModal = modal;

    // Return completion promise and clean up when resolved
    return modal.getCompletionPromise().finally(() => {
      this.activeModal = null;
    });
  }

  public showNodeSelectionModal(options: NodeSelectionModalOptions): Promise<NodeSelectionResult> {
    // Close any existing modal first
    this.closeActiveModal();

    // Create and show new modal
    const modal = new TinyCloudNodeSelectionModal({
      ...options,
      onDismiss: () => {
        this.activeModal = null;
        options.onDismiss?.();
      }
    });

    // Add to DOM
    document.body.appendChild(modal);
    this.activeModal = modal;

    // Return completion promise and clean up when resolved
    return modal.getCompletionPromise().finally(() => {
      this.activeModal = null;
    });
  }

  public closeActiveModal(): void {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }

  public hasActiveModal(): boolean {
    return this.activeModal !== null;
  }
}

// Export convenience function
export const showSpaceCreationModal = (options: SpaceCreationModalOptions): Promise<SpaceCreationResult> => {
  return ModalManager.getInstance().showSpaceCreationModal(options);
};

export const showNodeSelectionModal = (options: NodeSelectionModalOptions): Promise<NodeSelectionResult> => {
  return ModalManager.getInstance().showNodeSelectionModal(options);
};
