import type { Toast, ToastType } from './types';
import { GestureHandler } from './gestures';
import { ToastManager } from './ToastManager';

export class TinyCloudToastElement extends HTMLElement {
  private toast: Toast;
  private gestureHandler: GestureHandler;
  private dismissTimer?: number;
  private isDismissing: boolean = false;
  private isPaused: boolean = false;
  private pausedAt: number = 0;
  private remainingTime: number = 0;
  
  constructor(toast: Toast) {
    super();
    this.toast = toast;
    this.attachShadow({ mode: 'open' });
    this.render();
  }
  
  connectedCallback() {
    this.gestureHandler = new GestureHandler(this, this.handleSwipe.bind(this));
    this.remainingTime = this.toast.duration || 5000;
    this.startDismissTimer();
    this.playEnterAnimation();
    this.setupEventListeners();
  }
  
  disconnectedCallback() {
    this.gestureHandler?.destroy();
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }
  }
  
  private render() {
    const { type, title, description, action } = this.toast;
    
    this.shadowRoot!.innerHTML = `
      <style>${this.getToastStyles()}</style>
      <div class="toast toast--${type}" role="alert" aria-live="assertive" data-state="entering">
        <div class="toast__icon">${this.getIcon(type)}</div>
        <div class="toast__content">
          <div class="toast__title">${title}</div>
          ${description ? `<div class="toast__description">${description}</div>` : ''}
        </div>
        ${action ? `<button class="toast__action" data-interactive="true">${action.label}</button>` : ''}
        <button class="toast__close" data-interactive="true" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;
  }
  
  private getToastStyles(): string {
    return `
      :host {
        --toast-bg: hsl(0 0% 3.9%);
        --toast-border: hsl(0 0% 14.9%);
        --toast-foreground: hsl(0 0% 98%);
        --toast-muted: hsl(0 0% 63.9%);
        --toast-success-bg: hsl(143 85% 96%);
        --toast-success-border: hsl(145 92% 91%);
        --toast-success-foreground: hsl(140 100% 27%);
        --toast-success-rich: hsl(142 76% 36%);
        --toast-error-bg: hsl(359 100% 97%);
        --toast-error-border: hsl(359 100% 94%);
        --toast-error-foreground: hsl(360 100% 45%);
        --toast-error-rich: hsl(0 84% 60%);
        --toast-warning-bg: hsl(48 100% 96%);
        --toast-warning-border: hsl(48 100% 91%);
        --toast-warning-foreground: hsl(31 92% 45%);
        --toast-warning-rich: hsl(38 96% 54%);
        --toast-info-bg: hsl(214 95% 93%);
        --toast-info-border: hsl(213 97% 87%);
        --toast-info-foreground: hsl(210 92% 45%);
        --toast-info-rich: hsl(217 91% 60%);
      }
      
      .toast {
        background: var(--toast-bg);
        border: 1px solid var(--toast-border);
        color: var(--toast-foreground);
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        align-items: flex-start;
        gap: 14px;
        min-width: 320px;
        max-width: 440px;
        box-shadow: 
          0 4px 6px -1px rgba(0, 0, 0, 0.1),
          0 2px 4px -1px rgba(0, 0, 0, 0.06),
          0 0 0 1px rgba(255, 255, 255, 0.05);
        pointer-events: auto;
        user-select: none;
        position: relative;
        transform-origin: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        will-change: transform, opacity;
        z-index: 1;
      }
      
      .toast[data-state="entering"] {
        z-index: 10;
      }
      
      .toast[data-state="dismissing"] {
        z-index: 5;
        pointer-events: none;
      }
      
      .toast[data-state="gesture"] {
        z-index: 20;
        transition: none !important;
      }
      
      .toast:hover {
        transform: translateY(-1px);
        box-shadow: 
          0 10px 15px -3px rgba(0, 0, 0, 0.1),
          0 4px 6px -2px rgba(0, 0, 0, 0.05),
          0 0 0 1px rgba(255, 255, 255, 0.1);
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
      
      .toast--info {
        background: var(--toast-info-bg);
        border-color: var(--toast-info-border);
        color: var(--toast-info-foreground);
      }
      
      .toast__icon {
        flex-shrink: 0;
        margin-top: 1px;
        font-size: 18px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: 600;
      }
      
      .toast--success .toast__icon {
        background: var(--toast-success-rich);
        color: white;
        font-size: 12px;
      }
      
      .toast--error .toast__icon {
        background: var(--toast-error-rich);
        color: white;
        font-size: 12px;
      }
      
      .toast--warning .toast__icon {
        background: var(--toast-warning-rich);
        color: white;
        font-size: 12px;
      }
      
      .toast--info .toast__icon {
        background: var(--toast-info-rich);
        color: white;
        font-size: 12px;
      }
      
      .toast__content {
        flex: 1;
        min-width: 0;
      }
      
      .toast__title {
        font-weight: 600;
        margin-bottom: 2px;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .toast__description {
        font-size: 13px;
        color: var(--toast-muted);
        line-height: 1.4;
      }
      
      .toast__action {
        background: hsl(0 0% 10%);
        border: 1px solid hsl(0 0% 20%);
        color: hsl(0 0% 98%);
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        pointer-events: auto;
        touch-action: manipulation;
      }
      
      .toast__action:hover {
        background: hsl(0 0% 15%);
        border-color: hsl(0 0% 25%);
        transform: translateY(-1px);
      }
      
      .toast__action:active {
        transform: translateY(0);
      }
      
      .toast__close {
        background: transparent;
        border: none;
        color: hsl(0 0% 63.9%);
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        opacity: 0.7;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        touch-action: manipulation;
      }
      
      .toast__close:hover {
        opacity: 1;
        background: hsl(0 0% 15%);
        color: hsl(0 0% 98%);
      }
      
      @keyframes toast-enter {
        from {
          transform: translateY(100%) scale(0.9);
          opacity: 0;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }
      
      @keyframes toast-exit {
        from {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        to {
          transform: translateY(-100%) scale(0.9);
          opacity: 0;
        }
      }
      
      /* Ensure animations take precedence over inline styles */
      .toast[data-state="dismissing"] {
        animation: toast-exit 0.25s cubic-bezier(0.4, 0, 1, 1) forwards !important;
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
  
  private setupEventListeners(): void {
    const closeButton = this.shadowRoot!.querySelector('.toast__close');
    const actionButton = this.shadowRoot!.querySelector('.toast__action');
    
    closeButton?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isDismissing) {
        this.dismiss();
      }
    });
    
    if (actionButton && this.toast.action) {
      actionButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isDismissing) {
          this.toast.action!.onClick();
          this.dismiss();
        }
      });
    }
  }
  
  private startDismissTimer(): void {
    if (this.toast.duration && this.toast.duration !== Infinity && !this.isPaused) {
      this.dismissTimer = window.setTimeout(() => {
        this.dismiss();
      }, this.remainingTime);
    }
  }
  
  public pauseTimer(): void {
    if (this.dismissTimer && !this.isPaused) {
      clearTimeout(this.dismissTimer);
      this.pausedAt = Date.now();
      this.isPaused = true;
    }
  }
  
  public resumeTimer(): void {
    if (this.isPaused && this.pausedAt > 0) {
      const elapsed = Date.now() - this.pausedAt;
      this.remainingTime = Math.max(0, this.remainingTime - elapsed);
      this.isPaused = false;
      this.pausedAt = 0;
      
      if (this.remainingTime > 0) {
        this.startDismissTimer();
      } else {
        this.dismiss();
      }
    }
  }
  
  private playEnterAnimation(): void {
    const toastElement = this.shadowRoot!.querySelector('.toast') as HTMLElement;
    if (toastElement) {
      toastElement.style.animation = 'toast-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
      
      // Set state to active after animation completes
      setTimeout(() => {
        if (toastElement && !this.isDismissing) {
          toastElement.setAttribute('data-state', 'active');
        }
      }, 350);
    }
  }
  
  private handleSwipe(direction: 'left' | 'right'): void {
    if (!this.isDismissing) {
      this.dismiss('swipe');
    }
  }
  
  private dismiss(reason: 'timer' | 'click' | 'swipe' = 'click'): void {
    if (this.isDismissing) return;
    
    this.isDismissing = true;
    
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }
    
    const toastElement = this.shadowRoot!.querySelector('.toast') as HTMLElement;
    if (toastElement) {
      // Clear any gesture styles that might interfere
      toastElement.style.transform = '';
      toastElement.style.opacity = '';
      toastElement.style.transition = '';
      
      toastElement.setAttribute('data-state', 'dismissing');
      
      // Use CSS animation for consistent dismissal
      toastElement.style.animation = 'toast-exit 0.25s cubic-bezier(0.4, 0, 1, 1) forwards';
      
      // Wait for animation to complete before removing from DOM
      setTimeout(() => {
        // Double-check the element still exists before removal
        if (this.isConnected) {
          ToastManager.getInstance().remove(this.toast.id);
          this.remove();
        }
      }, 300); // Slightly longer than animation duration for safety
    }
  }
}

customElements.define('tinycloud-toast', TinyCloudToastElement);