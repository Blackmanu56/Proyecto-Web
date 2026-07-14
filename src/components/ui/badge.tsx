import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-full)] font-medium transition-colors duration-[var(--transition-default)]",
  {
    variants: {
      variant: {
        default:
          "bg-card border border-border text-text-muted",
        success:
          "bg-success-light text-success border border-success/20",
        warning:
          "bg-warning-light text-warning border border-warning/20",
        danger:
          "bg-danger-light text-danger border border-danger/20",
        info:
          "bg-info-light text-info border border-info/20",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
