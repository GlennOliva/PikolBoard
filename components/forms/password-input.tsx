"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  React.ComponentPropsWithoutRef<typeof Input>,
  "type"
> & {
  label?: React.ReactNode;
  labelAction?: React.ReactNode;
  error?: string;
  containerClassName?: string;
};

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      id,
      label,
      labelAction,
      error,
      containerClassName,
      className,
      autoComplete = "current-password",
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const [visible, setVisible] = React.useState(false);

    return (
      <div className={cn("grid gap-2", containerClassName)}>
        {label ? (
          <div className="flex items-center gap-3">
            <Label htmlFor={inputId}>{label}</Label>
            {labelAction ? <div className="ml-auto">{labelAction}</div> : null}
          </div>
        ) : null}

        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn("pr-12", className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            aria-controls={inputId}
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-pikol-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>

        {error ? (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
