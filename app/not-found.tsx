import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { productConfig } from "@/lib/product-config";

/**
 * Global 404.
 *
 * `notFound()` is thrown inside Suspense boundaries on most routes, so the
 * response status is already committed as 200 by the time it fires. Without a
 * boundary file the streamed skeleton is simply left on screen forever, which
 * reads as a broken page rather than a missing one.
 */
export default function NotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            That link does not point at anything on {productConfig.name}. It may
            have been mistyped, or the page may have been removed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/">Go to the home page</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}