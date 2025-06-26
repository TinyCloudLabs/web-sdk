import type { Toast, ToastConfig } from './types';

export class ToastManager {
  private static instance: ToastManager;
  private toasts: Map<string, Toast> = new Map();
  private subscribers: Set<(toasts: Toast[]) => void> = new Set();
  private container: any | null = null;
  private config: ToastConfig;
  
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
    const id = this.generateId();
    const newToast: Toast = {
      ...toast,
      id,
      timestamp: Date.now(),
      duration: toast.duration ?? this.config.duration
    };
    
    this.toasts.set(id, newToast);
    this.enforceMaxVisible();
    this.notify();
    
    return id;
  }
  
  public remove(id: string): void {
    this.toasts.delete(id);
    this.notify();
  }
  
  public clear(): void {
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
    const id = ToastManager.getInstance().add({ 
      type: 'loading', 
      title: messages.loading, 
      duration: Infinity 
    });
    
    return promise
      .then(result => {
        ToastManager.getInstance().remove(id);
        ToastManager.getInstance().add({ type: 'success', title: messages.success });
        return result;
      })
      .catch(error => {
        ToastManager.getInstance().remove(id);
        ToastManager.getInstance().add({ type: 'error', title: messages.error });
        throw error;
      });
  }
};