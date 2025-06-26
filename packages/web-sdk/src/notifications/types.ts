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

export interface SDKErrorDetail {
  category: string;
  message: string;
  description?: string;
}

export interface SDKEventDetail {
  message: string;
  description?: string;
}

export type SwipeDirection = 'left' | 'right';

export interface GestureHandlerOptions {
  threshold?: number;
  onSwipe: (direction: SwipeDirection) => void;
}