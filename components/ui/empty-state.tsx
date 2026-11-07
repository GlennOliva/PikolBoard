import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-empty-state="true"
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/70 p-6",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-lg border border-pikol-cyan/30 bg-pikol-cyan/10 text-pikol-cyan"
        >
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
      {action}
    </div>
  );
}
