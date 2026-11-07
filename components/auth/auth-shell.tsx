import Link from "next/link";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full max-w-md flex-col justify-center gap-5 py-4">
      <div className="flex flex-col items-start gap-3">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="PikolGo home"
        >
          <PikolgoLogo sizes="180px" className="h-10" />
        </Link>
        <p className="retro-kicker">Member access</p>
      </div>
      {children}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Courtside operations for organizers and players. Public live boards do
        not require an account.
      </p>
    </div>
  );
}
