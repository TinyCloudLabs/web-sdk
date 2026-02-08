import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ButtonProps {
  id?: string;
  className?: string;
  children: ReactNode;
  onClick: (e: any) => void;
  loading?: boolean;
  variant?: "default" | "neutral" | "link";
  size?: "default" | "sm" | "lg";
}

const variantStyles = {
  default:
    "bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-600 dark:hover:bg-blue-600",
  neutral:
    "bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700",
  link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-400 border-none",
};

const sizeStyles = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 py-1 text-xs",
  lg: "h-11 px-8 py-3",
};

const Button = ({
  id,
  className,
  children,
  onClick,
  loading,
  variant = "default",
  size = "default",
}: ButtonProps) => {
  return (
    <button
      id={id}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      onClick={!loading ? onClick : () => {}}
      disabled={loading}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
