# SDK Error Toast Notifications Implementation Plan

## Overview

This plan implements a framework-agnostic toast notification system inspired by shadcn sonner, integrated directly into the TinyCloud Web SDK. The system provides automatic error surfacing while maintaining the SDK's lightweight, modular architecture.

## Architecture

### Core Principles
- **Framework Agnostic**: Uses Web Components for universal compatibility
- **Self-Contained**: All functionality lives within `packages/web-sdk`
- **Zero Dependencies**: No additional runtime dependencies
- **Configuration Driven**: `popups: true, throwErrors: false` defaults
- **Sonner-Inspired**: Elegant stacking animations and gesture support

### Integration Points
```typescript
// packages/web-sdk/src/tcw.ts - Main SDK Class
interface TCWConfig extends TCWClientConfig {
  modules?: TCWModuleConfig;
  notifications?: {
    popups?: boolean;      // default: true
    throwErrors?: boolean; // default: false  
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    duration?: number;     // default: 5000ms
    maxVisible?: number;   // default: 3
  };
}
```

## File Structure

```
packages/web-sdk/src/
├── notifications/
│   ├── index.ts                    # Public exports
│   ├── ToastManager.ts             # Singleton manager class  
│   ├── ToastContainer.ts           # Web Component container
│   ├── ToastElement.ts             # Individual toast Web Component
│   ├── types.ts                    # TypeScript interfaces
│   ├── animations.ts               # Sonner-inspired animations
│   ├── gestures.ts                 # Swipe-to-dismiss handling
│   ├── styles.ts                   # CSS-in-JS styles
│   └── ErrorHandler.ts             # SDK error integration
├── tcw.ts                          # Updated main class
└── index.ts                        # Updated exports
```

## Implementation Details

### 1. Web Component Toast Container

```typescript
// packages/web-sdk/src/notifications/ToastContainer.ts
export class TinyCloudToastContainer extends HTMLElement {
  private shadowRoot: ShadowRoot;
  private toastManager: ToastManager;
  private position: ToastPosition = 'bottom-right';
  
  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
    this.render();
  }
  
  connectedCallback() {
    this.toastManager = ToastManager.getInstance();
    this.toastManager.subscribe(this.updateToasts.bind(this));
    this.setupEventListeners();
  }
  
  private render() {
    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="toast-viewport" data-position="${this.position}">
        <div class="toast-container"></div>
      </div>
    `;
  }
  
  private getStyles(): string {
    return `
      :host {
        --toast-bg: hsl(0 0% 9%);
        --toast-border: hsl(0 0% 20%);
        --toast-foreground: hsl(0 0% 98%);
        --toast-success-bg: hsl(143 85% 96%);
        --toast-success-border: hsl(145 92% 91%);
        --toast-success-foreground: hsl(140 100% 27%);
        --toast-error-bg: hsl(359 100% 97%);
        --toast-error-border: hsl(359 100% 94%);
        --toast-error-foreground: hsl(360 100% 45%);
        --toast-warning-bg: hsl(48 100% 96%);
        --toast-warning-border: hsl(48 100% 91%);
        --toast-warning-foreground: hsl(31 92% 45%);
      }
      
      .toast-viewport {
        position: fixed;
        z-index: 1000000;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 420px;
        margin: 16px;
      }
      
      .toast-viewport[data-position="bottom-right"] {
        bottom: 0;
        right: 0;
      }
      
      .toast-viewport[data-position="bottom-left"] {
        bottom: 0;
        left: 0;
      }
      
      .toast-viewport[data-position="top-right"] {
        top: 0;
        right: 0;
        flex-direction: column-reverse;
      }
      
      .toast-viewport[data-position="top-left"] {
        top: 0;
        left: 0;
        flex-direction: column-reverse;
      }
      
      .toast-viewport[data-position="top-center"] {
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        flex-direction: column-reverse;
      }
      
      .toast-viewport[data-position="bottom-center"] {
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
      }
    `;
  }
}

customElements.define('tinycloud-toast-container', TinyCloudToastContainer);
```

### 2. Individual Toast Element

```typescript
// packages/web-sdk/src/notifications/ToastElement.ts
export class TinyCloudToastElement extends HTMLElement {
  private toast: Toast;
  private gestureHandler: GestureHandler;
  
  constructor(toast: Toast) {
    super();
    this.toast = toast;
    this.attachShadow({ mode: 'open' });
    this.render();
  }
  
  connectedCallback() {
    this.gestureHandler = new GestureHandler(this, this.handleSwipe.bind(this));
    this.startDismissTimer();
    this.playEnterAnimation();
  }
  
  private render() {
    const { type, title, description, action } = this.toast;
    
    this.shadowRoot!.innerHTML = `
      <style>${this.getToastStyles()}</style>
      <div class="toast toast--${type}" role="alert" aria-live="assertive">
        <div class="toast__icon">${this.getIcon(type)}</div>
        <div class="toast__content">
          <div class="toast__title">${title}</div>
          ${description ? `<div class="toast__description">${description}</div>` : ''}
        </div>
        ${action ? `<button class="toast__action">${action.label}</button>` : ''}
        <button class="toast__close" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;
  }
  
  private getToastStyles(): string {
    return `
      .toast {
        background: var(--toast-bg);
        border: 1px solid var(--toast-border);
        color: var(--toast-foreground);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        min-width: 300px;
        max-width: 420px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        pointer-events: auto;
        user-select: none;
        position: relative;
        transform-origin: center;
        transition: transform 0.2s ease, opacity 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .toast:hover {
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }
      
      .toast--success {
        background: var(--toast-success-bg);
        border-color: var(--toast-success-border);
        color: var(--toast-success-foreground);
      }
      
      .toast--error {
        background: var(--toast-error-bg);
        border-color: var(--toast-error-border);
        color: var(--toast-error-foreground);
      }
      
      .toast--warning {
        background: var(--toast-warning-bg);
        border-color: var(--toast-warning-border);
        color: var(--toast-warning-foreground);
      }
      
      .toast__icon {
        flex-shrink: 0;
        margin-top: 2px;
      }
      
      .toast__content {
        flex: 1;
        min-width: 0;
      }
      
      .toast__title {
        font-weight: 500;
        margin-bottom: 4px;
      }
      
      .toast__description {
        font-size: 13px;
        opacity: 0.8;
        line-height: 1.3;
      }
      
      .toast__action {
        background: transparent;
        border: 1px solid currentColor;
        color: currentColor;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      
      .toast__action:hover {
        background: currentColor;
        color: var(--toast-bg);
      }
      
      .toast__close {
        background: transparent;
        border: none;
        color: currentColor;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.6;
        transition: opacity 0.15s ease;
        flex-shrink: 0;
      }
      
      .toast__close:hover {
        opacity: 1;
      }
    `;
  }
  
  private getIcon(type: ToastType): string {
    const icons = {
      success: '✓',
      error: '✕', 
      warning: '⚠',
      info: 'ℹ',
      loading: '◐'
    };
    return icons[type] || icons.info;
  }
}

customElements.define('tinycloud-toast', TinyCloudToastElement);
```

### 3. Toast Manager Singleton

```typescript
// packages/web-sdk/src/notifications/ToastManager.ts
export class ToastManager {
  private static instance: ToastManager;
  private toasts: Map<string, Toast> = new Map();
  private subscribers: Set<(toasts: Toast[]) => void> = new Set();
  private container: TinyCloudToastContainer | null = null;
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
    
    this.container = document.createElement('tinycloud-toast-container') as TinyCloudToastContainer;
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

// Global toast API (Sonner-style)
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
```

### 4. SDK Error Integration

```typescript
// packages/web-sdk/src/notifications/ErrorHandler.ts
export class SDKErrorHandler {
  private toastManager: ToastManager;
  private config: { popups: boolean; throwErrors: boolean };
  
  constructor(config: { popups: boolean; throwErrors: boolean }) {
    this.config = config;
    this.toastManager = ToastManager.getInstance();
  }
  
  public setupErrorHandling(): void {
    if (!this.config.popups) return;
    
    // Initialize toast container
    this.toastManager.initialize();
    
    // Listen for SDK error events
    window.addEventListener('tinycloud:error', this.handleError.bind(this));
    window.addEventListener('tinycloud:warning', this.handleWarning.bind(this));
    window.addEventListener('tinycloud:success', this.handleSuccess.bind(this));
    
    // Optionally handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }
  
  private handleError(event: CustomEvent): void {
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
  
  private handleWarning(event: CustomEvent): void {
    const { message, description } = event.detail;
    toast.warning(message, { description });
  }
  
  private handleSuccess(event: CustomEvent): void {
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

// Utility functions for dispatching SDK events
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
```

### 5. Gesture Handler

```typescript
// packages/web-sdk/src/notifications/gestures.ts
export class GestureHandler {
  private element: HTMLElement;
  private onSwipe: (direction: 'left' | 'right') => void;
  private startX = 0;
  private currentX = 0;
  private isDragging = false;
  private threshold = 100;
  
  constructor(element: HTMLElement, onSwipe: (direction: 'left' | 'right') => void) {
    this.element = element;
    this.onSwipe = onSwipe;
    this.bindEvents();
  }
  
  private bindEvents(): void {
    this.element.addEventListener('pointerdown', this.handleStart.bind(this));
    this.element.addEventListener('pointermove', this.handleMove.bind(this));
    this.element.addEventListener('pointerup', this.handleEnd.bind(this));
    this.element.addEventListener('pointercancel', this.handleEnd.bind(this));
  }
  
  private handleStart(e: PointerEvent): void {
    this.startX = e.clientX;
    this.currentX = e.clientX;
    this.isDragging = true;
    this.element.setPointerCapture(e.pointerId);
    this.element.style.transition = 'none';
  }
  
  private handleMove(e: PointerEvent): void {
    if (!this.isDragging) return;
    
    this.currentX = e.clientX;
    const deltaX = this.currentX - this.startX;
    const progress = Math.abs(deltaX) / this.threshold;
    const clampedProgress = Math.min(progress, 1);
    
    // Apply transform with resistance
    const resistance = 1 - (clampedProgress * 0.2);
    this.element.style.transform = `translateX(${deltaX * resistance}px) scale(${1 - clampedProgress * 0.05})`;
    this.element.style.opacity = `${1 - clampedProgress * 0.4}`;
  }
  
  private handleEnd(e: PointerEvent): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.element.releasePointerCapture(e.pointerId);
    
    const deltaX = this.currentX - this.startX;
    const shouldDismiss = Math.abs(deltaX) > this.threshold;
    
    if (shouldDismiss) {
      const direction = deltaX > 0 ? 'right' : 'left';
      this.animateOut(direction).then(() => this.onSwipe(direction));
    } else {
      this.animateBack();
    }
  }
  
  private animateOut(direction: 'left' | 'right'): Promise<void> {
    return new Promise(resolve => {
      this.element.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      this.element.style.transform = `translateX(${direction === 'right' ? '100%' : '-100%'}) scale(0.9)`;
      this.element.style.opacity = '0';
      
      setTimeout(resolve, 200);
    });
  }
  
  private animateBack(): void {
    this.element.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    this.element.style.transform = 'translateX(0) scale(1)';
    this.element.style.opacity = '1';
  }
  
  public destroy(): void {
    this.element.removeEventListener('pointerdown', this.handleStart);
    this.element.removeEventListener('pointermove', this.handleMove);
    this.element.removeEventListener('pointerup', this.handleEnd);
    this.element.removeEventListener('pointercancel', this.handleEnd);
  }
}
```

### 6. Updated TinyCloudWeb Class

```typescript
// packages/web-sdk/src/tcw.ts - Updated sections
interface TCWConfig extends TCWClientConfig {
  modules?: TCWModuleConfig;
  notifications?: {
    popups?: boolean;      // default: true
    throwErrors?: boolean; // default: false  
    position?: ToastPosition;
    duration?: number;
    maxVisible?: number;
  };
}

export class TinyCloudWeb {
  private errorHandler: SDKErrorHandler;
  
  constructor(private config: TCWConfig = TCW_DEFAULT_CONFIG) {
    // Existing initialization...
    
    // Initialize error handling system
    const notificationConfig = {
      popups: config.notifications?.popups ?? true,
      throwErrors: config.notifications?.throwErrors ?? false
    };
    
    this.errorHandler = new SDKErrorHandler(notificationConfig);
    
    if (notificationConfig.popups) {
      // Initialize toast manager with configuration
      ToastManager.getInstance({
        position: config.notifications?.position,
        duration: config.notifications?.duration,
        maxVisible: config.notifications?.maxVisible
      });
      
      this.errorHandler.setupErrorHandling();
    }
    
    // Existing module initialization...
  }
}
```

### 7. TypeScript Definitions

```typescript
// packages/web-sdk/src/notifications/types.ts
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type ToastPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  timestamp: number;
}

export interface ToastConfig {
  position?: ToastPosition;
  duration?: number;
  maxVisible?: number;
}

export interface NotificationConfig {
  popups?: boolean;
  throwErrors?: boolean;
  position?: ToastPosition;
  duration?: number;
  maxVisible?: number;
}
```

## Integration with Existing Error Points

### UserAuthorization Module
```typescript
// packages/web-sdk/src/modules/UserAuthorization.ts - Error integration examples
import { dispatchSDKEvent } from '../notifications/ErrorHandler';

export class UserAuthorization {
  async signIn(): Promise<TCWClientSession> {
    try {
      // Existing sign-in logic
    } catch (error) {
      if (error.code === 4001) {
        dispatchSDKEvent.error('auth.signature_rejected', 
          'Signature was rejected. Please try again');
      } else if (error.code === -32002) {
        dispatchSDKEvent.error('auth.wallet_not_connected', 
          'Please connect your wallet to continue');
      } else {
        dispatchSDKEvent.error('auth.general', 
          'Authentication failed', 
          error.message);
      }
      throw error;
    }
  }
}
```

### Storage Module
```typescript
// packages/web-sdk/src/modules/Storage/TinyCloudStorage.ts - Error integration
import { dispatchSDKEvent } from '../../notifications/ErrorHandler';

export class TinyCloudStorage {
  async upload(data: any): Promise<any> {
    try {
      // Existing upload logic
      dispatchSDKEvent.success('File uploaded successfully');
    } catch (error) {
      if (error.code === 'INSUFFICIENT_SPACE') {
        dispatchSDKEvent.error('storage.insufficient_space', 
          'Insufficient storage space available');
      } else if (error.code === 'NETWORK_ERROR') {
        dispatchSDKEvent.error('storage.upload_failed', 
          'Failed to upload file. Please check your connection');
      } else {
        dispatchSDKEvent.error('storage.general', 
          'Upload failed', 
          error.message);
      }
      throw error;
    }
  }
}
```

## Build System Integration

### Webpack Configuration Updates
```javascript
// packages/web-sdk/webpack.config.js - Updated sections
module.exports = {
  // Existing configuration...
  
  resolve: {
    fallback: {
      // Existing polyfills...
      // Web Components are natively supported in modern browsers
    }
  },
  
  optimization: {
    usedExports: true, // Enable tree shaking
    sideEffects: false // Mark package as side-effect-free
  }
};
```

### Package.json Updates
```json
{
  "dependencies": {
    // No additional dependencies needed - Web Components are native
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./notifications": {
      "import": "./dist/notifications/index.js",
      "require": "./dist/notifications/index.js", 
      "types": "./dist/notifications/index.d.ts"
    }
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
// packages/web-sdk/tests/notifications.test.ts
describe('Toast Notifications', () => {
  test('should display error toast when SDK error occurs', () => {
    // Test error event dispatching and toast creation
  });
  
  test('should respect popups: false configuration', () => {
    // Test that toasts are not shown when disabled
  });
  
  test('should throw errors when throwErrors: true', () => {
    // Test error throwing behavior
  });
});
```

### Integration Tests
```typescript
// Test with actual SDK operations
describe('SDK Error Integration', () => {
  test('should show toast on authentication failure', async () => {
    // Test actual auth failure scenarios
  });
  
  test('should show toast on storage operation failure', async () => {
    // Test actual storage failure scenarios
  });
});
```

## Usage Examples

### Basic SDK Usage with Default Notifications
```typescript
import { TinyCloudWeb } from '@tinycloud/web-sdk';

// Default configuration: popups: true, throwErrors: false
const tcw = new TinyCloudWeb();

// Errors automatically show as toasts
try {
  await tcw.signIn();
} catch (error) {
  // Error toast already shown, error still available for custom handling
  console.log('Sign-in failed:', error);
}
```

### Custom Configuration
```typescript
import { TinyCloudWeb } from '@tinycloud/web-sdk';

const tcw = new TinyCloudWeb({
  notifications: {
    popups: true,
    throwErrors: false,
    position: 'top-right',
    duration: 3000,
    maxVisible: 5
  }
});
```

### Programmatic Toast Usage
```typescript
import { toast } from '@tinycloud/web-sdk/notifications';

// Manual toast notifications
toast.success('Operation completed successfully');
toast.error('Something went wrong');
toast.warning('This action cannot be undone');

// Promise-based notifications
toast.promise(
  tcw.storage.upload(file),
  {
    loading: 'Uploading file...',
    success: 'File uploaded successfully',
    error: 'Failed to upload file'
  }
);
```

## Performance Considerations

### Bundle Size Impact
- **Estimated Addition**: ~8KB gzipped
- **Web Components**: Native browser APIs, no polyfills for modern browsers
- **Tree Shaking**: Fully tree-shakable when notifications disabled
- **Lazy Loading**: Toast container only created when first needed

### Runtime Performance
- **Memory Usage**: Minimal - only active toasts kept in memory
- **DOM Impact**: Shadow DOM isolation prevents style conflicts
- **Animation Performance**: GPU-accelerated transforms
- **Event Handling**: Efficient event delegation and cleanup

## Browser Compatibility

### Modern Browsers (Full Support)
- Chrome 54+ (Web Components v1)
- Firefox 63+ (Web Components v1)
- Safari 10.1+ (Web Components v1)
- Edge 79+ (Chromium-based)

### Fallback Strategy
- Graceful degradation to console.error() for unsupported browsers
- Feature detection for Web Components support
- Optional polyfill loading for legacy support

## Migration and Rollout

### Phase 1: Implementation
1. Implement core toast system in `packages/web-sdk/src/notifications/`
2. Update `TinyCloudWeb` class with notification configuration
3. Add error dispatching to existing error handling points

### Phase 2: Integration
1. Update existing error handling in `UserAuthorization`
2. Update existing error handling in `TinyCloudStorage` 
3. Add success notifications for key operations

### Phase 3: Documentation and Testing
1. Add comprehensive unit and integration tests
2. Update documentation with configuration examples
3. Create migration guide for existing users

### Phase 4: Release
1. Semantic versioning (minor version bump)
2. Feature flag for gradual rollout
3. Monitor bundle size and performance impact

This implementation provides a production-ready, framework-agnostic toast notification system that enhances the TinyCloud Web SDK user experience while maintaining backward compatibility and performance standards.