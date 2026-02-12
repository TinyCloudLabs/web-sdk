import * as AccordionPrimitive from "@radix-ui/react-accordion"
import type { AccordionItemProps, AccordionTriggerProps, AccordionContentProps } from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import * as React from "react"

import { cn } from "../../utils/utils"

// Cast Radix primitives to work around @types/react version mismatch between
// workspace root (v19, includes bigint in ReactNode) and this package (v18).
const RadixItem = AccordionPrimitive.Item as React.ForwardRefExoticComponent<
  AccordionItemProps & React.RefAttributes<HTMLDivElement>
>
const RadixHeader = AccordionPrimitive.Header as React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>
>
const RadixTrigger = AccordionPrimitive.Trigger as React.ForwardRefExoticComponent<
  AccordionTriggerProps & React.RefAttributes<HTMLButtonElement>
>
const RadixContent = AccordionPrimitive.Content as React.ForwardRefExoticComponent<
  AccordionContentProps & React.RefAttributes<HTMLDivElement>
>

const Accordion = AccordionPrimitive.Root as React.ForwardRefExoticComponent<
  (AccordionPrimitive.AccordionSingleProps | AccordionPrimitive.AccordionMultipleProps) &
    React.RefAttributes<HTMLDivElement>
>

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, ...props }, ref) => (
    <RadixItem
      ref={ref}
      className={cn(
        "rounded-base overflow-x-hidden border-2 border-b border-border shadow-shadow",
        className,
      )}
      {...props}
    />
  ),
)
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <RadixHeader className="flex">
      <RadixTrigger
        ref={ref}
        className={cn(
          "flex flex-1 items-center justify-between text-text border-border bg-main p-4 font-heading transition-all [&[data-state=open]>svg]:rotate-180 [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-2",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
      </RadixTrigger>
    </RadixHeader>
  ),
)
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => (
    <RadixContent
      ref={ref}
      className="overflow-hidden rounded-b-base bg-white dark:bg-secondaryBlack text-sm font-base transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("p-4", className)}>{children as React.ReactNode}</div>
    </RadixContent>
  ),
)

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
