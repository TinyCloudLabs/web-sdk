import React from 'react';
import { cn } from '../../utils/utils';

export interface NeoBrutalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'neutral' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  animation?: 'hover' | 'bounce' | 'none';
  children: React.ReactNode;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const NeoBrutalButton = React.forwardRef<HTMLButtonElement, NeoBrutalButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    animation = 'hover', 
    loading = false,
    leftIcon,
    rightIcon,
    children, 
    disabled,
    ...props 
  }, ref) => {
    const baseClasses = [
      'inline-flex items-center justify-center',
      'neo-border neo-rounded font-semibold',
      'cursor-pointer select-none',
      'focus:outline-none focus:ring-3 focus:ring-blue-300',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'neo-transition',
      'text-center whitespace-nowrap',
      'relative overflow-hidden'
    ];

    const variantClasses = {
      primary: 'neo-bg-blue neo-text-inverse neo-shadow neo-hover',
      secondary: 'neo-bg-secondary neo-text-primary neo-shadow neo-hover',
      neutral: 'neo-bg-neutral neo-text-inverse neo-shadow neo-hover',
      outline: 'bg-transparent neo-text-primary neo-border neo-shadow neo-hover',
      ghost: 'bg-transparent neo-text-primary hover:neo-bg-secondary'
    };

    const sizeClasses = {
      sm: 'h-8 px-3 text-sm min-w-[2rem] gap-1',
      md: 'h-10 px-4 text-base min-w-[2.5rem] gap-2',
      lg: 'h-12 px-6 text-lg min-w-[3rem] gap-2',
      xl: 'h-14 px-8 text-xl font-bold min-w-[3.5rem] gap-3',
      icon: 'h-10 w-10 p-0'
    };

    const animationClasses = {
      hover: 'neo-hover',
      bounce: 'hover:neo-bounce',
      none: ''
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          !isDisabled && animationClasses[animation],
          isDisabled && 'cursor-not-allowed opacity-50',
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full neo-spin"></div>
          </div>
        )}

        {/* Button content */}
        <div className={cn(
          'flex items-center justify-center',
          size === 'icon' ? '' : 'gap-2',
          loading && 'opacity-0'
        )}>
          {leftIcon && (
            <span className="flex-shrink-0">
              {leftIcon}
            </span>
          )}
          
          {size !== 'icon' && (
            <span className="flex-shrink-0">
              {children}
            </span>
          )}
          
          {size === 'icon' && !leftIcon && !rightIcon && (
            <span className="flex-shrink-0">
              {children}
            </span>
          )}
          
          {rightIcon && (
            <span className="flex-shrink-0">
              {rightIcon}
            </span>
          )}
        </div>
      </button>
    );
  }
);

NeoBrutalButton.displayName = 'NeoBrutalButton';

export const NeoButton = NeoBrutalButton;

export const NeoButtonPrimary = (props: Omit<NeoBrutalButtonProps, 'variant'>) => (
  <NeoBrutalButton variant="primary" {...props} />
);

export const NeoButtonSecondary = (props: Omit<NeoBrutalButtonProps, 'variant'>) => (
  <NeoBrutalButton variant="secondary" {...props} />
);

export const NeoButtonNeutral = (props: Omit<NeoBrutalButtonProps, 'variant'>) => (
  <NeoBrutalButton variant="neutral" {...props} />
);

export const NeoButtonOutline = (props: Omit<NeoBrutalButtonProps, 'variant'>) => (
  <NeoBrutalButton variant="outline" {...props} />
);

export const NeoButtonGhost = (props: Omit<NeoBrutalButtonProps, 'variant'>) => (
  <NeoBrutalButton variant="ghost" {...props} />
);

export const NeoButtonSuccess = NeoButtonPrimary;
export const NeoButtonWarning = NeoButtonSecondary;
export const NeoButtonInfo = NeoButtonPrimary;
export const NeoButtonDanger = NeoButtonNeutral;

export const NeoButtonBouncy = (props: Omit<NeoBrutalButtonProps, 'animation'>) => (
  <NeoBrutalButton animation="bounce" {...props} />
);

export const NeoButtonShaky = NeoButtonBouncy;
export const NeoButtonSpinny = NeoButtonBouncy;
export const NeoButtonGlowy = NeoButtonBouncy;

export { NeoBrutalButton };
export default NeoBrutalButton;