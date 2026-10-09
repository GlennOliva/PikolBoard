import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * An unknown live board. Also covers a session whose organizer has since
 * un-published it, since that is indistinguishable from outside.
 */
export default function LiveBoardNotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            This board is not available
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            The session may have finished, or the organizer may have stopped
            sharing it. Ask them for a fresh link.
          </p>
        </div>

        <Button asChild size="sm" variant="outline">
          <Link href="/">Back to the home page</Link>
        </Button>
      </CardContent>
    </Card>
  );
}