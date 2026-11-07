import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";
import { SiteNav } from "@/components/layout/site-nav";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[100] w-full border-b border-border/70 bg-pikol-deep/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/"
            className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="PikolGo home"
          >
            <PikolgoLogo
              priority
              sizes="180px"
              className="h-8 sm:h-9"
            />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <Link
              href="/clubs"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              My clubs
            </Link>
            <Link
              href="/protected"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {hasEnvVars ? (
            <Suspense fallback={<div className="h-10 w-24" aria-hidden />}>
              <AuthButton />
            </Suspense>
          ) : null}
          <ThemeSwitcher />
          <Suspense fallback={<div className="size-11" aria-hidden />}>
            <SiteNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
