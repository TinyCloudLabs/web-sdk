import type { SwipeDirection } from './types';

export class GestureHandler {
  private element: HTMLElement;
  private onSwipe: (direction: SwipeDirection) => void;
  private startX = 0;
  private currentX = 0;
  private isDragging = false;
  private isGestureActive = false;
  private threshold = 100;
  private gestureStartThreshold = 8; // Minimum pixels to start gesture
  private toastElement: HTMLElement | null = null;
  private animationFrame: number | null = null;
  private startTime = 0;
  private elementWidth = 0;
  
  constructor(element: HTMLElement, onSwipe: (direction: SwipeDirection) => void) {
    this.element = element;
    this.onSwipe = onSwipe;
    this.toastElement = element.shadowRoot?.querySelector('.toast') as HTMLElement;
    this.bindEvents();
    this.setupGestureStyles();
  }
  
  private bindEvents(): void {
    this.element.addEventListener('pointerdown', this.handleStart.bind(this), { passive: false });
    this.element.addEventListener('pointermove', this.handleMove.bind(this), { passive: false });
    this.element.addEventListener('pointerup', this.handleEnd.bind(this));
    this.element.addEventListener('pointercancel', this.handleEnd.bind(this));
  }
  
  private setupGestureStyles(): void {
    if (!this.toastElement) return;
    
    // Add CSS custom properties for gesture transforms
    const style = document.createElement('style');
    style.textContent = `
      .toast {
        --gesture-x: 0px;
        --gesture-scale: 1;
        --gesture-opacity: 1;
      }
      
      .toast[data-state="gesture"] {
        transform: translateX(var(--gesture-x)) scale(var(--gesture-scale)) !important;
        opacity: var(--gesture-opacity) !important;
        transition: none !important;
      }
    `;
    
    this.element.shadowRoot?.appendChild(style);
  }
  
  private handleStart(e: PointerEvent): void {
    // Prevent if toast is already dismissing
    if (this.toastElement?.getAttribute('data-state') === 'dismissing') {
      return;
    }
    
    // Check if the pointer is over an interactive element (button)
    const target = e.target as Element;
    if (this.isInteractiveElement(target)) {
      return; // Don't capture gestures on buttons
    }
    
    // Don't prevent default immediately - let buttons work normally
    this.startX = e.clientX;
    this.currentX = e.clientX;
    this.startTime = Date.now();
    this.isDragging = true;
    this.isGestureActive = false; // Don't activate gesture until threshold met
    
    // Store element width for consistent pixel-based animations
    if (this.toastElement) {
      this.elementWidth = this.toastElement.offsetWidth;
    }
    
    this.element.setPointerCapture(e.pointerId);
  }
  
  private isInteractiveElement(element: Element | null): boolean {
    if (!element) return false;
    
    // Check if element or its parents are interactive
    let current = element;
    while (current && current !== this.element) {
      const tagName = current.tagName.toLowerCase();
      const className = current.className;
      
      if (tagName === 'button' || 
          className.includes('toast__close') || 
          className.includes('toast__action') ||
          current.hasAttribute('data-interactive')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }
  
  private handleMove(e: PointerEvent): void {
    if (!this.isDragging || !this.toastElement) return;
    
    this.currentX = e.clientX;
    const deltaX = this.currentX - this.startX;
    
    // Only activate gesture mode after threshold is met
    if (!this.isGestureActive && Math.abs(deltaX) > this.gestureStartThreshold) {
      this.isGestureActive = true;
      this.toastElement.setAttribute('data-state', 'gesture');
      e.preventDefault(); // Now prevent default since we're in gesture mode
    }
    
    // Only process gesture if active
    if (!this.isGestureActive) return;
    
    e.preventDefault();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(() => {
      const progress = Math.abs(deltaX) / this.threshold;
      const clampedProgress = Math.min(progress, 1);
      
      const resistance = 1 - (clampedProgress * 0.2);
      const finalDeltaX = deltaX * resistance;
      const scale = 1 - clampedProgress * 0.05;
      const opacity = 1 - clampedProgress * 0.4;
      
      // Use consistent pixel values throughout
      this.toastElement!.style.setProperty('--gesture-x', `${finalDeltaX}px`);
      this.toastElement!.style.setProperty('--gesture-scale', scale.toString());
      this.toastElement!.style.setProperty('--gesture-opacity', opacity.toString());
    });
  }
  
  private handleEnd(e: PointerEvent): void {
    if (!this.isDragging || !this.toastElement) return;
    
    this.isDragging = false;
    this.element.releasePointerCapture(e.pointerId);
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // If gesture was never activated (below threshold), just reset
    if (!this.isGestureActive) {
      this.isGestureActive = false;
      return; // Let click events proceed normally
    }
    
    const deltaX = this.currentX - this.startX;
    const timeElapsed = Date.now() - this.startTime;
    const velocity = Math.abs(deltaX) / timeElapsed; // pixels per ms
    
    // Consider velocity for quicker dismissals
    const shouldDismiss = Math.abs(deltaX) > this.threshold || velocity > 0.5;
    
    if (shouldDismiss) {
      const direction = deltaX > 0 ? 'right' : 'left';
      this.animateOut(direction, deltaX).then(() => {
        this.cleanup();
        this.onSwipe(direction);
      });
    } else {
      this.animateBack();
    }
  }
  
  private animateOut(direction: SwipeDirection, currentDeltaX: number): Promise<void> {
    return new Promise(resolve => {
      if (!this.toastElement) {
        resolve();
        return;
      }
      
      // Calculate target in pixels for smooth continuation
      const targetDistance = this.elementWidth + Math.abs(currentDeltaX);
      const targetX = direction === 'right' ? targetDistance : -targetDistance;
      
      // Set dismissing state
      this.toastElement.setAttribute('data-state', 'dismissing');
      this.toastElement.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 1, 1), opacity 0.25s ease';
      
      // Continue from current position to off-screen in same direction
      this.toastElement.style.setProperty('--gesture-x', `${targetX}px`);
      this.toastElement.style.setProperty('--gesture-scale', '0.9');
      this.toastElement.style.setProperty('--gesture-opacity', '0');
      
      setTimeout(resolve, 250);
    });
  }
  
  private animateBack(): void {
    if (!this.toastElement) return;
    
    // Smoothly animate back to original position
    this.toastElement.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    this.toastElement.style.setProperty('--gesture-x', '0px');
    this.toastElement.style.setProperty('--gesture-scale', '1');
    this.toastElement.style.setProperty('--gesture-opacity', '1');
    
    // Reset to active state after animation
    setTimeout(() => {
      if (this.toastElement && this.toastElement.getAttribute('data-state') !== 'dismissing') {
        this.toastElement.setAttribute('data-state', 'active');
        this.isGestureActive = false;
        this.cleanup();
      }
    }, 300);
  }
  
  private cleanup(): void {
    if (!this.toastElement) return;
    
    // Clear all custom properties
    this.toastElement.style.removeProperty('--gesture-x');
    this.toastElement.style.removeProperty('--gesture-scale');
    this.toastElement.style.removeProperty('--gesture-opacity');
    this.toastElement.style.transition = '';
  }
  
  public destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    this.cleanup();
    
    this.element.removeEventListener('pointerdown', this.handleStart);
    this.element.removeEventListener('pointermove', this.handleMove);
    this.element.removeEventListener('pointerup', this.handleEnd);
    this.element.removeEventListener('pointercancel', this.handleEnd);
    
    this.toastElement = null;
  }
}