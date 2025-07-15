import * as React from "react"
import { cn } from "../../utils/utils"

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            "absolute z-50 max-w-xs rounded-base border-2 border-border bg-bw p-2 text-xs text-text shadow-shadow",
            "left-1/2 top-full mt-2 -translate-x-1/2",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}