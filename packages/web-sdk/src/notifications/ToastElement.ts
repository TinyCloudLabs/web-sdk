import type { Toast, ToastType } from './types';
import { GestureHandler } from './gestures';
import { ToastManager } from './ToastManager';

export class TinyCloudToastElement extends HTMLElement {
  private toast: Toast;
  private gestureHandler: GestureHandler;
  private dismissTimer?: number;
  
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
        font-size: 16px;
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
      
      @keyframes toast-enter {
        from {
          transform: translateY(100%) scale(0.95);
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
          transform: translateY(-100%) scale(0.95);
          opacity: 0;
        }
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
    
    closeButton?.addEventListener('click', () => {
      this.dismiss();
    });
    
    if (actionButton && this.toast.action) {
      actionButton.addEventListener('click', () => {
        this.toast.action!.onClick();
        this.dismiss();
      });
    }
  }
  
  private startDismissTimer(): void {
    if (this.toast.duration && this.toast.duration !== Infinity) {
      this.dismissTimer = window.setTimeout(() => {
        this.dismiss();
      }, this.toast.duration);
    }
  }
  
  private playEnterAnimation(): void {
    const toastElement = this.shadowRoot!.querySelector('.toast') as HTMLElement;
    if (toastElement) {
      toastElement.style.animation = 'toast-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  }
  
  private handleSwipe(direction: 'left' | 'right'): void {
    this.dismiss();
  }
  
  private dismiss(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }
    
    const toastElement = this.shadowRoot!.querySelector('.toast') as HTMLElement;
    if (toastElement) {
      toastElement.style.animation = 'toast-exit 0.2s ease forwards';
      setTimeout(() => {
        ToastManager.getInstance().remove(this.toast.id);
        this.remove();
      }, 200);
    }
  }
}

customElements.define('tinycloud-toast', TinyCloudToastElement);