import type { Toast, ToastConfig } from './types';

export class ToastManager {
  private static instance: ToastManager;
  private toasts: Map<string, Toast> = new Map();
  private subscribers: Set<(toasts: Toast[]) => void> = new Set();
  private container: any | null = null;
  private config: ToastConfig;
  private debounceTimers: Map<string, number> = new Map();
  private toastHashes: Map<string, string> = new Map();
  
  private constructor(config: ToastConfig = {}) {
    this.config = {
      position: 'bottom-right',
      duration: 5000,
      maxVisible: 3,
      ...config
    };
  }
  
  public static getInstance(config?: ToastConfig): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager(config);
    }
    return ToastManager.instance;
  }
  
  public initialize(): void {
    if (typeof window === 'undefined') return;
    
    this.container = document.createElement('tinycloud-toast-container');
    this.container.setAttribute('data-position', this.config.position!);
    document.body.appendChild(this.container);
  }
  
  public add(toast: Omit<Toast, 'id' | 'timestamp'>): string {
    const toastHash = this.hashToast(toast);
    
    // Check for duplicate toasts
    const existingId = this.findDuplicateToast(toastHash);
    if (existingId) {
      // Update existing toast instead of creating new one
      this.updateToast(existingId, toast);
      return existingId;
    }
    
    // Debounce rapid successive identical toasts
    if (this.debounceTimers.has(toastHash)) {
      clearTimeout(this.debounceTimers.get(toastHash));
    }
    
    const debounceDelay = 300; // 300ms debounce
    const timeoutId = window.setTimeout(() => {
      this.debounceTimers.delete(toastHash);
      
      const id = this.generateId();
      const newToast: Toast = {
        ...toast,
        id,
        timestamp: Date.now(),
        duration: toast.duration ?? this.config.duration
      };
      
      this.toasts.set(id, newToast);
      this.toastHashes.set(id, toastHash);
      this.enforceMaxVisible();
      this.notify();
    }, debounceDelay);
    
    this.debounceTimers.set(toastHash, timeoutId);
    
    // Return a temporary ID for immediate operations
    return `temp-${toastHash}`;
  }
  
  public remove(id: string): void {
    if (id.startsWith('temp-')) {
      // Handle temporary IDs from debounced toasts
      const hash = id.replace('temp-', '');
      if (this.debounceTimers.has(hash)) {
        clearTimeout(this.debounceTimers.get(hash));
        this.debounceTimers.delete(hash);
      }
      return;
    }
    
    const hash = this.toastHashes.get(id);
    if (hash) {
      this.toastHashes.delete(id);
      // Clear any pending debounced toasts of the same type
      if (this.debounceTimers.has(hash)) {
        clearTimeout(this.debounceTimers.get(hash));
        this.debounceTimers.delete(hash);
      }
    }
    
    this.toasts.delete(id);
    this.notify();
  }
  
  public clear(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timerId => clearTimeout(timerId));
    this.debounceTimers.clear();
    this.toastHashes.clear();
    this.toasts.clear();
    this.notify();
  }
  
  public subscribe(callback: (toasts: Toast[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  private enforceMaxVisible(): void {
    const toastArray = Array.from(this.toasts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (toastArray.length > this.config.maxVisible!) {
      const toastsToRemove = toastArray.slice(this.config.maxVisible!);
      toastsToRemove.forEach(toast => this.toasts.delete(toast.id));
    }
  }
  
  private notify(): void {
    const toastArray = Array.from(this.toasts.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    this.subscribers.forEach(callback => callback(toastArray));
  }
  
  private generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private hashToast(toast: Omit<Toast, 'id' | 'timestamp'>): string {
    // Create a hash based on type, title, and description for deduplication
    const key = `${toast.type}-${toast.title}-${toast.description || ''}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }
  
  private findDuplicateToast(hash: string): string | null {
    for (const [id, toastHash] of this.toastHashes.entries()) {
      if (toastHash === hash && this.toasts.has(id)) {
        return id;
      }
    }
    return null;
  }
  
  private updateToast(id: string, updates: Omit<Toast, 'id' | 'timestamp'>): void {
    const existingToast = this.toasts.get(id);
    if (existingToast) {
      const updatedToast: Toast = {
        ...existingToast,
        ...updates,
        id: existingToast.id,
        timestamp: existingToast.timestamp,
        duration: updates.duration ?? existingToast.duration
      };
      this.toasts.set(id, updatedToast);
      this.notify();
    }
  }
}

export const toast = {
  success: (title: string, options?: Partial<Toast>) => 
    ToastManager.getInstance().add({ type: 'success', title, ...options }),
  
  error: (title: string, options?: Partial<Toast>) => 
    ToastManager.getInstance().add({ type: 'error', title, ...options }),
  
  warning: (title: string, options?: Partial<Toast>) => 
    ToastManager.getInstance().add({ type: 'warning', title, ...options }),
  
  info: (title: string, options?: Partial<Toast>) => 
    ToastManager.getInstance().add({ type: 'info', title, ...options }),
  
  loading: (title: string, options?: Partial<Toast>) => 
    ToastManager.getInstance().add({ type: 'loading', title, duration: Infinity, ...options }),
  
  promise: <T>(
    promise: Promise<T>, 
    messages: { loading: string; success: string; error: string }
  ): Promise<T> => {
    const manager = ToastManager.getInstance();
    
    // Create loading toast
    const loadingId = manager.add({ 
      type: 'loading', 
      title: messages.loading, 
      duration: Infinity 
    });
    
    return promise
      .then(result => {
        manager.remove(loadingId);
        // Add a small delay to prevent rapid loading->success transition
        setTimeout(() => {
          manager.add({ type: 'success', title: messages.success });
        }, 150);
        return result;
      })
      .catch(error => {
        manager.remove(loadingId);
        // Add a small delay to prevent rapid loading->error transition
        setTimeout(() => {
          manager.add({ type: 'error', title: messages.error });
        }, 150);
        throw error;
      });
  }
};