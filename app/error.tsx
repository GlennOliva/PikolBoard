"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="retro-corners mx-auto max-w-2xl">
      <CardContent className="flex flex-col items-start gap-5 py-12">
        <PikolgoLogo sizes="150px" className="h-8" />
        <div>
          <p className="retro-kicker">System interruption</p>
          <h1 className="retro-heading mt-3 text-3xl">The board hit an error</h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Your session data was not changed. Try this screen again, or return
            home if the interruption continues.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
