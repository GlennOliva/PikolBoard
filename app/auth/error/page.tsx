import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Code error: {params.error}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          An unspecified error occurred.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Sorry, something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <ErrorContent searchParams={searchParams} />
          </Suspense>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
