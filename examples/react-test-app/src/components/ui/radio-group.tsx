import * as React from "react"
import { cn } from "../../utils/utils"

export interface RadioOption {
  value: string
  label: string
}

export interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  inline?: boolean
  className?: string
  label?: string
}

export function RadioGroup({
  name,
  options,
  value,
  onChange,
  inline = false,
  className,
  label
}: RadioGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="font-base text-sm text-text">{label}</div>
      )}
      <div className={cn("space-y-2", inline && "inline-flex space-x-4 space-y-0")}>
        {options.map((option) => (
          <div
            key={option.value}
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => onChange(option.value)}
          >
            <div className={cn(
              "h-4 w-4 rounded-full border-2 border-border bg-bw flex items-center justify-center",
              value === option.value && "border-4"
            )}>
            </div>
            <label className="font-base text-sm text-text cursor-pointer">
              {option.label}
            </label>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
          </div>
        ))}
      </div>
    </div>
  )
}