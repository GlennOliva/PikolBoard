import { cn } from "@/lib/utils";

/**
 * PikolGo's original mark: a paddle and ball drawn as simple geometry, so it
 * stays legible at favicon size and inherits the surrounding text colour.
 */
export function ProductMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-6", className)}
    >
      <rect
        x="4.25"
        y="4.75"
        width="14.5"
        height="19.5"
        rx="7.25"
        transform="rotate(-18 4.25 4.75)"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M16.8 20.1 22.6 27"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="25" cy="9.5" r="3" fill="currentColor" />
      <path
        d="M26.5 17.5h3M25 21h2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".65"
      />
    </svg>
  );
}
