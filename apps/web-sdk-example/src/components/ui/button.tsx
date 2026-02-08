import { Slot as RadixSlot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../../utils/utils'

// Cast Radix Slot to work around @types/react version mismatch between
// workspace root (v19) and this package (v18).
const Slot = RadixSlot as React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>
>

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-ringOffset transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-main text-mtext border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
        noShadow: 'bg-main text-mtext border-2 border-border',
        link: 'underline-offset-4 text-text hover:underline',
        neutral:
          'bg-bw text-text border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
        reverse:
          'bg-main text-mtext border-2 border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 py-1 text-xs',
        lg: 'h-11 px-8 py-3',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {loading ? (
          <div className="mr-2">
            <img
              src="/spinner.svg"
              alt="Loading..."
              className="h-4 w-4 animate-spin"
            />
          </div>
        ) : null}
        {children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }