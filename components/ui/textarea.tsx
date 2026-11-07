import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-background/55 px-3 py-2 text-base shadow-inner transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/70 hover:border-pikol-cyan/35 focus-visible:border-pikol-cyan focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/25 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
