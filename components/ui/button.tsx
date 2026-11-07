import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-semibold tracking-wide transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-retro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary/50 bg-primary text-primary-foreground shadow-[0_1px_0_hsl(var(--ring)/0.25),0_0_24px_hsl(var(--primary)/0.18)] hover:bg-primary/90 hover:shadow-[0_2px_0_hsl(var(--ring)/0.2),0_0_30px_hsl(var(--primary)/0.24)]",
        destructive:
          "border-destructive/50 bg-destructive text-destructive-foreground shadow-[0_0_20px_hsl(var(--destructive)/0.15)] hover:bg-destructive/90",
        outline:
          "border-pikol-cyan/35 bg-transparent text-foreground hover:border-pikol-cyan/70 hover:bg-pikol-cyan/10 hover:text-pikol-cyan",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/60 hover:text-foreground",
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-10 rounded-md px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
