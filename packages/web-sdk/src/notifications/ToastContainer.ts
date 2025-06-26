import type { Toast, ToastPosition } from './types';
import { ToastManager } from './ToastManager';
import { TinyCloudToastElement } from './ToastElement';

export class TinyCloudToastContainer extends HTMLElement {
  public shadowRoot: ShadowRoot;
  private toastManager: ToastManager;
  private position: ToastPosition = 'bottom-right';
  private unsubscribe?: () => void;
  
  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
    this.render();
  }
  
  connectedCallback() {
    this.toastManager = ToastManager.getInstance();
    this.position = (this.getAttribute('data-position') as ToastPosition) || 'bottom-right';
    this.unsubscribe = this.toastManager.subscribe(this.updateToasts.bind(this));
    this.setupEventListeners();
  }
  
  disconnectedCallback() {
    this.unsubscribe?.();
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
      
      .toast-container {
        display: flex;
        flex-direction: inherit;
        gap: inherit;
      }
    `;
  }
  
  private setupEventListeners(): void {
    this.addEventListener('mouseenter', this.pauseTimers.bind(this));
    this.addEventListener('mouseleave', this.resumeTimers.bind(this));
  }
  
  private updateToasts(toasts: Toast[]): void {
    const container = this.shadowRoot.querySelector('.toast-container');
    if (!container) return;
    
    const existingToasts = new Set(
      Array.from(container.children).map(el => (el as TinyCloudToastElement).getAttribute('data-toast-id'))
    );
    
    const currentToasts = new Set(toasts.map(toast => toast.id));
    
    existingToasts.forEach(toastId => {
      if (toastId && !currentToasts.has(toastId)) {
        const element = container.querySelector(`[data-toast-id="${toastId}"]`);
        element?.remove();
      }
    });
    
    toasts.forEach(toast => {
      if (!existingToasts.has(toast.id)) {
        const toastElement = new TinyCloudToastElement(toast);
        toastElement.setAttribute('data-toast-id', toast.id);
        
        if (this.position.startsWith('top')) {
          container.appendChild(toastElement);
        } else {
          container.insertBefore(toastElement, container.firstChild);
        }
      }
    });
    
    this.updatePosition();
  }
  
  private updatePosition(): void {
    const viewport = this.shadowRoot.querySelector('.toast-viewport');
    if (viewport) {
      viewport.setAttribute('data-position', this.position);
    }
  }
  
  private pauseTimers(): void {
    const toastElements = this.shadowRoot.querySelectorAll('tinycloud-toast');
    toastElements.forEach(element => {
      (element as any).pauseTimer?.();
    });
  }
  
  private resumeTimers(): void {
    const toastElements = this.shadowRoot.querySelectorAll('tinycloud-toast');
    toastElements.forEach(element => {
      (element as any).resumeTimer?.();
    });
  }
}

customElements.define('tinycloud-toast-container', TinyCloudToastContainer);