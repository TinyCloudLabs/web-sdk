import type { Toast, ToastPosition } from './types';
import { ToastManager } from './ToastManager';
import { TinyCloudToastElement } from './ToastElement';

export class TinyCloudToastContainer extends HTMLElement {
  private toastManager: ToastManager;
  private position: ToastPosition = 'bottom-right';
  private unsubscribe?: () => void;
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }
  
  connectedCallback() {
    this.toastManager = ToastManager.getInstance();
    this.position = (this.getAttribute('data-position') as ToastPosition) || 'bottom-right';
    this.unsubscribe = this.toastManager.subscribe(this.updateToasts.bind(this));
    this.setupEventListeners();
    this.observeToastStates();
  }
  
  disconnectedCallback() {
    this.unsubscribe?.();
  }
  
  private render() {
    this.shadowRoot!.innerHTML = `
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
        gap: 12px;
        max-width: 440px;
        margin: 16px;
        isolation: isolate;
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
        position: relative;
        isolation: isolate;
      }
      
      /* Ensure proper stacking during animations */
      tinycloud-toast {
        position: relative;
        transform-style: preserve-3d;
      }
      
      tinycloud-toast:nth-child(1) { z-index: 100; }
      tinycloud-toast:nth-child(2) { z-index: 99; }
      tinycloud-toast:nth-child(3) { z-index: 98; }
      tinycloud-toast:nth-child(4) { z-index: 97; }
      tinycloud-toast:nth-child(5) { z-index: 96; }
      
      /* Higher z-index for toasts being interacted with */
      tinycloud-toast[data-state="gesture"] {
        z-index: 200 !important;
      }
      
      tinycloud-toast[data-state="entering"] {
        z-index: 150 !important;
      }
    `;
  }
  
  private setupEventListeners(): void {
    this.addEventListener('mouseenter', this.pauseTimers.bind(this));
    this.addEventListener('mouseleave', this.resumeTimers.bind(this));
  }
  
  private updateToasts(toasts: Toast[]): void {
    const container = this.shadowRoot!.querySelector('.toast-container');
    if (!container) return;
    
    const existingToasts = new Set(
      Array.from(container.children).map(el => (el as TinyCloudToastElement).getAttribute('data-toast-id'))
    );
    
    const currentToasts = new Set(toasts.map(toast => toast.id));
    
    // Remove toasts that are no longer in the list
    existingToasts.forEach(toastId => {
      if (toastId && !currentToasts.has(toastId)) {
        const element = container.querySelector(`[data-toast-id="${toastId}"]`);
        if (element) {
          // Only remove if not currently dismissing to avoid animation conflicts
          const toastEl = element.shadowRoot?.querySelector('.toast');
          if (toastEl?.getAttribute('data-state') !== 'dismissing') {
            element.remove();
          }
        }
      }
    });
    
    // Add new toasts
    toasts.forEach((toast, index) => {
      if (!existingToasts.has(toast.id)) {
        const toastElement = new TinyCloudToastElement(toast);
        toastElement.setAttribute('data-toast-id', toast.id);
        
        // Set initial z-index based on position in array
        const zIndex = 100 - index;
        toastElement.style.setProperty('--toast-z-index', zIndex.toString());
        
        if (this.position.startsWith('top')) {
          container.appendChild(toastElement);
        } else {
          container.insertBefore(toastElement, container.firstChild);
        }
      }
    });
    
    // Update z-indices for existing toasts to maintain proper stacking
    this.updateStackingOrder();
    this.updatePosition();
  }
  
  private updateStackingOrder(): void {
    const container = this.shadowRoot!.querySelector('.toast-container');
    if (!container) return;
    
    const toastElements = Array.from(container.children) as TinyCloudToastElement[];
    
    toastElements.forEach((element, index) => {
      const baseZIndex = 100 - index;
      element.style.setProperty('--toast-z-index', baseZIndex.toString());
      
      // Check if toast is being interacted with and adjust z-index accordingly
      const toastEl = element.shadowRoot?.querySelector('.toast');
      const state = toastEl?.getAttribute('data-state');
      
      if (state === 'gesture') {
        element.style.setProperty('--toast-z-index', '200');
      } else if (state === 'entering') {
        element.style.setProperty('--toast-z-index', '150');
      }
    });
  }
  
  private updatePosition(): void {
    const viewport = this.shadowRoot!.querySelector('.toast-viewport');
    if (viewport) {
      viewport.setAttribute('data-position', this.position);
    }
  }
  
  private pauseTimers(): void {
    const toastElements = this.shadowRoot!.querySelectorAll('tinycloud-toast');
    toastElements.forEach(element => {
      const toastElement = element as any;
      if (typeof toastElement.pauseTimer === 'function') {
        toastElement.pauseTimer();
      }
    });
  }
  
  private resumeTimers(): void {
    const toastElements = this.shadowRoot!.querySelectorAll('tinycloud-toast');
    toastElements.forEach(element => {
      const toastElement = element as any;
      if (typeof toastElement.resumeTimer === 'function') {
        toastElement.resumeTimer();
      }
    });
  }
  
  // Observer for toast state changes to update stacking
  private observeToastStates(): void {
    const container = this.shadowRoot!.querySelector('.toast-container');
    if (!container) return;
    
    const observer = new MutationObserver(() => {
      this.updateStackingOrder();
    });
    
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state']
    });
  }
}

customElements.define('tinycloud-toast-container', TinyCloudToastContainer);