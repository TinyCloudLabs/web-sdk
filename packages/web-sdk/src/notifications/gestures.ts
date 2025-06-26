import type { SwipeDirection } from './types';

export class GestureHandler {
  private element: HTMLElement;
  private onSwipe: (direction: SwipeDirection) => void;
  private startX = 0;
  private currentX = 0;
  private isDragging = false;
  private threshold = 100;
  
  constructor(element: HTMLElement, onSwipe: (direction: SwipeDirection) => void) {
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
  
  private animateOut(direction: SwipeDirection): Promise<void> {
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