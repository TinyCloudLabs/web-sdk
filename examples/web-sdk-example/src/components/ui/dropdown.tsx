import * as React from "react"
import { cn } from "../../utils/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface DropdownOption {
  name: string
  content?: React.ReactNode
}

export interface DropdownProps {
  label: string
  options: DropdownOption[]
  className?: string
}

export function Dropdown({ label, options, className }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between rounded-base border-2 border-border bg-bw p-4 text-text",
          isOpen && "rounded-b-none"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="font-base">{label}</div>
        <div>{isOpen ? <ChevronUp /> : <ChevronDown />}</div>
      </div>
      
      {isOpen && (
        <div className="absolute z-10 w-full rounded-base rounded-t-none border-2 border-t-0 border-border bg-bw">
          {options.map((option, index) => (
            <div
              key={index}
              className={cn(
                "p-4 text-text",
                index !== options.length - 1 && "border-b border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="font-base">{option.name}</div>
                <div>{option.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}