import React from 'react';
import { cn } from '../../utils/utils';

export interface NeoBrutalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'neutral' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shadow?: 'sm' | 'md' | 'lg' | 'none';
  animation?: 'hover' | 'none';
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const NeoBrutalCard = React.forwardRef<HTMLDivElement, NeoBrutalCardProps>(
  ({ 
    className, 
    variant = 'default', 
    size = 'md', 
    shadow = 'md', 
    animation = 'none',
    header,
    footer,
    children, 
    ...props 
  }, ref) => {
    const baseClasses = [
      'neo-border neo-rounded',
      'relative',
      'neo-transition'
    ];

    const variantClasses = {
      default: 'neo-bg-card neo-text-primary',
      primary: 'neo-bg-blue neo-text-inverse',
      secondary: 'neo-bg-secondary neo-text-primary',
      neutral: 'neo-bg-neutral neo-text-inverse',
      outline: 'bg-transparent neo-text-primary neo-border'
    };

    const sizeClasses = {
      sm: 'neo-p-sm',
      md: 'neo-p-md',
      lg: 'neo-p-lg',
      xl: 'neo-p-xl'
    };

    const shadowClasses = {
      sm: 'neo-shadow-sm',
      md: 'neo-shadow',
      lg: 'neo-shadow-lg',
      none: 'neo-shadow-none'
    };

    const animationClasses = {
      hover: 'neo-hover',
      none: ''
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          shadowClasses[shadow],
          animationClasses[animation],
          className
        )}
        {...props}
      >
        {/* Header */}
        {header && (
          <div className="neo-border-bottom neo-p-sm mb-4">
            {header}
          </div>
        )}

        {/* Main content */}
        <div className="relative">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="neo-border-top neo-p-sm mt-4">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

NeoBrutalCard.displayName = 'NeoBrutalCard';

export const NeoCard = NeoBrutalCard;

export const NeoCardDefault = (props: Omit<NeoBrutalCardProps, 'variant'>) => (
  <NeoBrutalCard variant="default" {...props} />
);

export const NeoCardPrimary = (props: Omit<NeoBrutalCardProps, 'variant'>) => (
  <NeoBrutalCard variant="primary" {...props} />
);

export const NeoCardSecondary = (props: Omit<NeoBrutalCardProps, 'variant'>) => (
  <NeoBrutalCard variant="secondary" {...props} />
);

export const NeoCardNeutral = (props: Omit<NeoBrutalCardProps, 'variant'>) => (
  <NeoBrutalCard variant="neutral" {...props} />
);

export const NeoCardOutline = (props: Omit<NeoBrutalCardProps, 'variant'>) => (
  <NeoBrutalCard variant="outline" {...props} />
);

export const NeoCardAccent = NeoCardPrimary;
export const NeoCardSuccess = NeoCardPrimary;
export const NeoCardWarning = NeoCardSecondary;
export const NeoCardInfo = NeoCardPrimary;
export const NeoCardDanger = NeoCardNeutral;
export const NeoCardGhost = NeoCardOutline;

export const NeoCardFloating = (props: Omit<NeoBrutalCardProps, 'animation'>) => (
  <NeoBrutalCard animation="hover" {...props} />
);

export const NeoCardTilted = NeoCardFloating;
export const NeoCardGlowing = NeoCardFloating;
export const NeoCardGradient = NeoCardFloating;
export const NeoCardFloaty = NeoCardFloating;
export const NeoCardShaky = NeoCardFloating;

export const NeoCardHeader = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('neo-heading neo-text-primary', className)} {...props}>
    {children}
  </div>
);

export const NeoCardTitle = ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('neo-subheading neo-text-primary', className)} {...props}>
    {children}
  </h3>
);

export const NeoCardContent = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('neo-body neo-text-primary', className)} {...props}>
    {children}
  </div>
);

export const NeoCardFooter = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('neo-small neo-text-secondary flex items-center justify-between', className)} {...props}>
    {children}
  </div>
);

export { NeoBrutalCard };
export default NeoBrutalCard;