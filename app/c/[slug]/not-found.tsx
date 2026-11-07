import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A shared club link that does not resolve. Usually a typo in the slug, or a
 * club that is private, which looks identical from the outside on purpose.
 */
export default function ClubNotFound() {
  return (
    <Card className="retro-corners mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-start gap-4 py-12">
        <div>
          <p className="retro-kicker">Public board unavailable</p>
          <h1 className="retro-heading mt-3 text-3xl">Club not found</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            No public club matches this link. Check the address you were sent,
            because the club may not be published.
          </p>
        </div>

        <Button asChild size="sm" variant="outline">
          <Link href="/">Back to the home page</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
