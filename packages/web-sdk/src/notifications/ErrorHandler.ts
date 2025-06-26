import type { SDKErrorDetail, SDKEventDetail } from './types';
import { ToastManager, toast } from './ToastManager';

export class SDKErrorHandler {
  private toastManager: ToastManager;
  private config: { popups: boolean; throwErrors: boolean };
  
  constructor(config: { popups: boolean; throwErrors: boolean }) {
    this.config = config;
    this.toastManager = ToastManager.getInstance();
  }
  
  public setupErrorHandling(): void {
    if (!this.config.popups) return;
    
    this.toastManager.initialize();
    
    window.addEventListener('tinycloud:error', this.handleError.bind(this));
    window.addEventListener('tinycloud:warning', this.handleWarning.bind(this));
    window.addEventListener('tinycloud:success', this.handleSuccess.bind(this));
    
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }
  
  private handleError(event: CustomEvent<SDKErrorDetail>): void {
    const { message, description, category } = event.detail;
    
    toast.error(this.getErrorMessage(category, message), {
      description,
      action: category === 'wallet' ? {
        label: 'Retry',
        onClick: () => this.retryWalletConnection()
      } : undefined
    });
    
    if (this.config.throwErrors) {
      throw new Error(message);
    }
  }
  
  private handleWarning(event: CustomEvent<SDKEventDetail>): void {
    const { message, description } = event.detail;
    toast.warning(message, { description });
  }
  
  private handleSuccess(event: CustomEvent<SDKEventDetail>): void {
    const { message, description } = event.detail;
    toast.success(message, { description });
  }
  
  private getErrorMessage(category: string, defaultMessage: string): string {
    const errorMessages: Record<string, string> = {
      'auth.wallet_not_connected': 'Please connect your wallet to continue',
      'auth.signature_rejected': 'Signature was rejected. Please try again',
      'auth.chain_mismatch': 'Please switch to the correct network',
      'storage.upload_failed': 'Failed to upload file. Please check your connection',
      'storage.insufficient_space': 'Insufficient storage space available',
      'storage.permission_denied': 'Permission denied. Please check your access rights',
      'network.connection_failed': 'Network connection failed. Please try again',
      'network.timeout': 'Request timed out. Please try again',
      'wasm.initialization_failed': 'Failed to initialize security module'
    };
    
    return errorMessages[category] || defaultMessage;
  }
  
  private retryWalletConnection(): void {
    window.dispatchEvent(new CustomEvent('tinycloud:retry-wallet-connection'));
  }
  
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    if (event.reason?.message?.includes('tinycloud')) {
      toast.error('An unexpected error occurred', {
        description: 'Please try refreshing the page'
      });
    }
  }
}

export const dispatchSDKEvent = {
  error: (category: string, message: string, description?: string) => {
    window.dispatchEvent(new CustomEvent('tinycloud:error', {
      detail: { category, message, description }
    }));
  },
  
  warning: (message: string, description?: string) => {
    window.dispatchEvent(new CustomEvent('tinycloud:warning', {
      detail: { message, description }
    }));
  },
  
  success: (message: string, description?: string) => {
    window.dispatchEvent(new CustomEvent('tinycloud:success', {
      detail: { message, description }
    }));
  }
};