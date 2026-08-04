import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest2 transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/20 text-primary",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success:
          "border-board-up/40 bg-board-up/15 text-board-up",
        danger:
          "border-board-down/40 bg-board-down/15 text-board-down",
        muted:
          "border-border/50 bg-muted/40 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
