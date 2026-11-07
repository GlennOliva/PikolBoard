import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[0.68rem] font-semibold uppercase leading-none tracking-[0.12em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-primary/35 bg-primary/12 text-primary",
        secondary: "border-border bg-muted/55 text-muted-foreground",
        destructive: "border-destructive/35 bg-destructive/12 text-destructive",
        outline: "border-border bg-transparent text-foreground",
        live: "border-pikol-cyan/45 bg-pikol-cyan/15 text-pikol-cyan",
        "on-air":
          "border-pikol-secondary/55 bg-pikol-secondary/16 text-pikol-secondary",
        success: "border-pikol-success/35 bg-pikol-success/12 text-pikol-success",
        warning: "border-pikol-warning/35 bg-pikol-warning/12 text-pikol-warning",
        danger: "border-pikol-danger/40 bg-pikol-danger/12 text-pikol-danger",
        gold: "border-pikol-gold/45 bg-pikol-gold/12 text-pikol-gold",
        silver: "border-pikol-silver/40 bg-pikol-silver/12 text-pikol-silver",
        bronze: "border-pikol-secondary/40 bg-pikol-secondary/12 text-pikol-secondary",
        draft: "border-border bg-muted/45 text-muted-foreground",
        "up-next": "border-primary/45 bg-primary/14 text-primary",
        preparing:
          "border-pikol-purple/55 bg-pikol-purple/18 text-foreground",
        playing: "border-pikol-success/40 bg-pikol-success/12 text-pikol-success",
        completed: "border-border bg-muted/45 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
