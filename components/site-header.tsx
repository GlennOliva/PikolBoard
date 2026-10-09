import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { productConfig } from "@/lib/product-config";

/**
 * Site header. Authenticated state comes from AuthButton, which reads the
 * session on the server, so the whole bar sits behind a Suspense boundary to
 * keep it out of the static shell (cacheComponents is on).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
            >
              PB
            </span>
            <span>{productConfig.name}</span>
          </Link>
          <Link
            href="/protected"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {hasEnvVars ? (
            <Suspense fallback={<div className="h-9 w-24" />}>
              <AuthButton />
            </Suspense>
          ) : null}
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
