import * as React from "react"
import { HelpCircle } from "lucide-react"
import { Tooltip } from "./tooltip"
import { cn } from "../../utils/utils"

interface HelperIconProps {
  tooltip: string
  className?: string
}

export function HelperIcon({ tooltip, className }: HelperIconProps) {
  return (
    <Tooltip content={tooltip}>
      <div className={cn("inline-flex cursor-help items-center justify-center", className)}>
        <HelpCircle className="h-4 w-4 text-text/70" />
      </div>
    </Tooltip>
  )
}