import React from 'react';
import { cn } from '../../utils/utils';

export interface NeoBrutalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: 'default' | 'primary' | 'secondary' | 'neutral' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animation?: 'hover' | 'focus' | 'none';
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
  showBorder?: boolean;
}

const NeoBrutalInput = React.forwardRef<HTMLInputElement, NeoBrutalInputProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md', 
    animation = 'focus',
    label,
    helperText,
    error,
    leftIcon,
    rightIcon,
    isLoading = false,
    showBorder = true,
    disabled,
    ...props 
  }, ref) => {
    const baseClasses = [
      'w-full',
      'neo-rounded',
      'neo-transition',
      'focus:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'placeholder:neo-text-secondary placeholder:font-medium'
    ];

    const borderClasses = showBorder ? 'neo-border' : 'border-0';

    const variantClasses = {
      default: 'neo-bg-card neo-text-primary focus:ring-3 focus:ring-blue-300',
      primary: 'neo-bg-blue neo-text-inverse focus:ring-3 focus:ring-blue-500',
      secondary: 'neo-bg-secondary neo-text-primary focus:ring-3 focus:ring-blue-300',
      neutral: 'neo-bg-neutral neo-text-inverse focus:ring-3 focus:ring-gray-300',
      outline: 'bg-transparent neo-text-primary neo-border focus:ring-3 focus:ring-blue-300'
    };

    const sizeClasses = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
      lg: 'h-12 px-5 text-lg',
      xl: 'h-14 px-6 text-xl'
    };

    const animationClasses = {
      hover: 'hover:neo-shadow-lg',
      focus: 'focus:neo-shadow-lg',
      none: ''
    };

    const hasError = !!error;
    const finalVariant = hasError ? 'outline' : variant;

    return (
      <div className="w-full space-y-2">
        {/* Label */}
        {label && (
          <label className={cn(
            'neo-body font-semibold neo-text-primary',
            'block'
          )}>
            {label}
            {props.required && <span className="neo-text-blue ml-1">*</span>}
          </label>
        )}

        {/* Input container */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 neo-text-secondary">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            className={cn(
              baseClasses,
              borderClasses,
              variantClasses[finalVariant],
              sizeClasses[size],
              animationClasses[animation],
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              isLoading && 'pr-10',
              hasError && 'ring-2 ring-red-500 border-red-500',
              className
            )}
            disabled={disabled || isLoading}
            {...props}
          />

          {/* Right icon or loading spinner */}
          {(rightIcon || isLoading) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 neo-text-secondary">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full neo-spin"></div>
              ) : (
                rightIcon
              )}
            </div>
          )}
        </div>

        {/* Helper text or error */}
        {(helperText || error) && (
          <div className={cn(
            'neo-small',
            hasError ? 'text-red-500' : 'neo-text-secondary'
          )}>
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

NeoBrutalInput.displayName = 'NeoBrutalInput';

export const NeoInput = NeoBrutalInput;

export const NeoInputDefault = (props: Omit<NeoBrutalInputProps, 'variant'>) => (
  <NeoBrutalInput variant="default" {...props} />
);

export const NeoInputPrimary = (props: Omit<NeoBrutalInputProps, 'variant'>) => (
  <NeoBrutalInput variant="primary" {...props} />
);

export const NeoInputSecondary = (props: Omit<NeoBrutalInputProps, 'variant'>) => (
  <NeoBrutalInput variant="secondary" {...props} />
);

export const NeoInputNeutral = (props: Omit<NeoBrutalInputProps, 'variant'>) => (
  <NeoBrutalInput variant="neutral" {...props} />
);

export const NeoInputOutline = (props: Omit<NeoBrutalInputProps, 'variant'>) => (
  <NeoBrutalInput variant="outline" {...props} />
);

export const NeoInputAccent = NeoInputPrimary;
export const NeoInputSuccess = NeoInputPrimary;
export const NeoInputWarning = NeoInputSecondary;
export const NeoInputInfo = NeoInputPrimary;
export const NeoInputDanger = NeoInputNeutral;
export const NeoInputGhost = NeoInputOutline;

export const NeoInputBrutal = (props: Omit<NeoBrutalInputProps, 'animation'>) => (
  <NeoBrutalInput animation="hover" {...props} />
);

export const NeoInputGlowing = NeoInputBrutal;
export const NeoInputBouncy = NeoInputBrutal;
export const NeoInputShaky = NeoInputBrutal;

export const NeoInputGroup = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-4', className)} {...props}>
    {children}
  </div>
);

export const NeoInputLabel = ({ children, className, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) => (
  <label className={cn('neo-body font-semibold neo-text-primary block', className)} {...props}>
    {children}
    {required && <span className="neo-text-blue ml-1">*</span>}
  </label>
);

export const NeoInputHelperText = ({ children, className, error, ...props }: React.HTMLAttributes<HTMLDivElement> & { error?: boolean }) => (
  <div className={cn('neo-small', error ? 'text-red-500' : 'neo-text-secondary', className)} {...props}>
    {children}
  </div>
);

export const NeoTextarea = React.forwardRef<HTMLTextAreaElement, Omit<NeoBrutalInputProps, 'type'> & React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md', 
    animation = 'focus',
    label,
    helperText,
    error,
    isLoading = false,
    showBorder = true,
    disabled,
    ...props 
  }, ref) => {
    const baseClasses = [
      'w-full',
      'neo-rounded',
      'neo-transition',
      'focus:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'placeholder:neo-text-secondary placeholder:font-medium',
      'resize-none'
    ];

    const borderClasses = showBorder ? 'neo-border' : 'border-0';

    const variantClasses = {
      default: 'neo-bg-card neo-text-primary focus:ring-3 focus:ring-blue-300',
      primary: 'neo-bg-blue neo-text-inverse focus:ring-3 focus:ring-blue-500',
      secondary: 'neo-bg-secondary neo-text-primary focus:ring-3 focus:ring-blue-300',
      neutral: 'neo-bg-neutral neo-text-inverse focus:ring-3 focus:ring-gray-300',
      outline: 'bg-transparent neo-text-primary neo-border focus:ring-3 focus:ring-blue-300'
    };

    const sizeClasses = {
      sm: 'min-h-[2rem] px-3 py-2 text-sm',
      md: 'min-h-[2.5rem] px-4 py-2 text-base',
      lg: 'min-h-[3rem] px-5 py-3 text-lg',
      xl: 'min-h-[3.5rem] px-6 py-3 text-xl'
    };

    const animationClasses = {
      hover: 'hover:neo-shadow-lg',
      focus: 'focus:neo-shadow-lg',
      none: ''
    };

    const hasError = !!error;
    const finalVariant = hasError ? 'outline' : variant;

    return (
      <div className="w-full space-y-2">
        {/* Label */}
        {label && (
          <label className={cn(
            'neo-body font-semibold neo-text-primary',
            'block'
          )}>
            {label}
            {props.required && <span className="neo-text-blue ml-1">*</span>}
          </label>
        )}

        {/* Textarea container */}
        <div className="relative">
          <textarea
            ref={ref}
            className={cn(
              baseClasses,
              borderClasses,
              variantClasses[finalVariant],
              sizeClasses[size],
              animationClasses[animation],
              hasError && 'ring-2 ring-red-500 border-red-500',
              className
            )}
            disabled={disabled || isLoading}
            {...props}
          />

          {/* Loading spinner */}
          {isLoading && (
            <div className="absolute right-3 top-3 neo-text-secondary">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full neo-spin"></div>
            </div>
          )}
        </div>

        {/* Helper text or error */}
        {(helperText || error) && (
          <div className={cn(
            'neo-small',
            hasError ? 'text-red-500' : 'neo-text-secondary'
          )}>
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

NeoTextarea.displayName = 'NeoTextarea';

export { NeoBrutalInput };
export default NeoBrutalInput;