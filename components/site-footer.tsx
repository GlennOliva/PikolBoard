import Link from "next/link";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";
import { productConfig } from "@/lib/product-config";

export function SiteFooter() {
  return (
    <footer className="site-footer mt-12 border-t border-border/70 bg-pikol-deep/75">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-md flex-col gap-3">
          <Link
            href="/"
            className="w-fit rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="PikolGo home"
          >
            <PikolgoLogo sizes="120px" className="h-7" />
          </Link>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {productConfig.tagline} Built for organizers, players, and the
            people watching the next game.
          </p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <Link href="/clubs" className="transition-colors hover:text-foreground">
            My clubs
          </Link>
          <Link href="/auth/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/auth/sign-up" className="transition-colors hover:text-foreground">
            Sign up
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          © 2026 {productConfig.organization}
        </p>
      </div>
    </footer>
  );
}
