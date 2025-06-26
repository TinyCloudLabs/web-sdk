import type { SDKErrorDetail, SDKEventDetail } from './types';
import { ToastManager, toast } from './ToastManager';

export class SDKErrorHandler {
  private static instance: SDKErrorHandler | null = null;
  private toastManager: ToastManager;
  private config: { popups: boolean; throwErrors: boolean };
  private isInitialized: boolean = false;
  private boundHandlers: {
    error: (event: CustomEvent<SDKErrorDetail>) => void;
    warning: (event: CustomEvent<SDKEventDetail>) => void;
    success: (event: CustomEvent<SDKEventDetail>) => void;
    unhandledRejection: (event: PromiseRejectionEvent) => void;
  };
  
  private constructor(config: { popups: boolean; throwErrors: boolean }) {
    this.config = config;
    this.toastManager = ToastManager.getInstance();
    
    // Bind handlers to maintain context and enable proper cleanup
    this.boundHandlers = {
      error: this.handleError.bind(this),
      warning: this.handleWarning.bind(this),
      success: this.handleSuccess.bind(this),
      unhandledRejection: this.handleUnhandledRejection.bind(this)
    };
  }
  
  public static getInstance(config?: { popups: boolean; throwErrors: boolean }): SDKErrorHandler {
    if (!SDKErrorHandler.instance && config) {
      SDKErrorHandler.instance = new SDKErrorHandler(config);
    } else if (!SDKErrorHandler.instance) {
      throw new Error('SDKErrorHandler must be initialized with config on first call');
    }
    return SDKErrorHandler.instance;
  }
  
  public static reset(): void {
    if (SDKErrorHandler.instance) {
      SDKErrorHandler.instance.cleanup();
      SDKErrorHandler.instance = null;
    }
  }
  
  public setupErrorHandling(): void {
    if (!this.config.popups || this.isInitialized) return;
    
    this.toastManager.initialize();
    
    // Remove any existing listeners first to prevent duplicates
    this.cleanup();
    
    // Add new listeners
    window.addEventListener('tinycloud:error', this.boundHandlers.error);
    window.addEventListener('tinycloud:warning', this.boundHandlers.warning);
    window.addEventListener('tinycloud:success', this.boundHandlers.success);
    window.addEventListener('unhandledrejection', this.boundHandlers.unhandledRejection);
    
    this.isInitialized = true;
  }
  
  public cleanup(): void {
    if (!this.isInitialized) return;
    
    window.removeEventListener('tinycloud:error', this.boundHandlers.error);
    window.removeEventListener('tinycloud:warning', this.boundHandlers.warning);
    window.removeEventListener('tinycloud:success', this.boundHandlers.success);
    window.removeEventListener('unhandledrejection', this.boundHandlers.unhandledRejection);
    
    this.isInitialized = false;
  }
  
  public updateConfig(config: { popups: boolean; throwErrors: boolean }): void {
    const wasInitialized = this.isInitialized;
    
    if (wasInitialized) {
      this.cleanup();
    }
    
    this.config = config;
    
    if (wasInitialized && config.popups) {
      this.setupErrorHandling();
    }
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
    // Only handle SDK-related promise rejections
    const reason = event.reason;
    const isSDKError = reason?.message?.includes('tinycloud') || 
                      reason?.message?.includes('TinyCloud') ||
                      reason?.stack?.includes('tinycloud');
    
    if (isSDKError) {
      toast.error('An unexpected error occurred', {
        description: 'Please try refreshing the page'
      });
    }
  }
}

// Debounced event dispatcher to prevent duplicate events
class SDKEventDispatcher {
  private eventQueue: Map<string, NodeJS.Timeout> = new Map();
  private readonly debounceDelay = 200; // 200ms debounce
  
  private dispatch(eventType: string, detail: any): void {
    const eventKey = `${eventType}-${JSON.stringify(detail)}`;
    
    // Clear existing timeout for this event
    if (this.eventQueue.has(eventKey)) {
      clearTimeout(this.eventQueue.get(eventKey)!);
    }
    
    // Set new timeout
    const timeoutId = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(eventType, { detail }));
      this.eventQueue.delete(eventKey);
    }, this.debounceDelay);
    
    this.eventQueue.set(eventKey, timeoutId);
  }
  
  error(category: string, message: string, description?: string): void {
    this.dispatch('tinycloud:error', { category, message, description });
  }
  
  warning(message: string, description?: string): void {
    this.dispatch('tinycloud:warning', { message, description });
  }
  
  success(message: string, description?: string): void {
    this.dispatch('tinycloud:success', { message, description });
  }
  
  cleanup(): void {
    this.eventQueue.forEach(timeoutId => clearTimeout(timeoutId));
    this.eventQueue.clear();
  }
}

const eventDispatcher = new SDKEventDispatcher();

export const dispatchSDKEvent = {
  error: eventDispatcher.error.bind(eventDispatcher),
  warning: eventDispatcher.warning.bind(eventDispatcher),
  success: eventDispatcher.success.bind(eventDispatcher),
  cleanup: eventDispatcher.cleanup.bind(eventDispatcher)
};