import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, error, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-10 w-full rounded-[var(--radius-md)] border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-secondary transition-colors duration-[var(--transition-default)]",
              "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand",
              "disabled:cursor-not-allowed disabled:opacity-50",
              leftIcon && "pl-10",
              error
                ? "border-danger focus-visible:outline-danger"
                : "border-border hover:border-border-hover focus-visible:outline-brand",
              className
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
