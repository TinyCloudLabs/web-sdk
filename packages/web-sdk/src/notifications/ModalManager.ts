import { TinyCloudOrbitModal, type OrbitCreationModalOptions, type OrbitCreationResult } from './OrbitCreationModal';

export class ModalManager {
  private static instance: ModalManager;
  private activeModal: TinyCloudOrbitModal | null = null;

  private constructor() {}

  public static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  public showOrbitCreationModal(options: OrbitCreationModalOptions): Promise<OrbitCreationResult> {
    // Close any existing modal first
    this.closeActiveModal();

    // Create and show new modal
    const modal = new TinyCloudOrbitModal({
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
export const showOrbitCreationModal = (options: OrbitCreationModalOptions): Promise<OrbitCreationResult> => {
  return ModalManager.getInstance().showOrbitCreationModal(options);
};