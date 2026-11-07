import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg border border-border/60 bg-muted/55",
        className,
      )}
      {...props}
    />
  );
}

export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={label}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
