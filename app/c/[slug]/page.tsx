import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Radio, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getPublicClub,
  getPublicClubSessions,
  getPublicStandings,
} from "@/lib/db/queries";
import { formatTime, initialsOf } from "@/lib/format";
import { productConfig } from "@/lib/product-config";

/**
 * Anonymous club page. Everything here comes from the sanitized public_* views,
 * so there is no session and no way to reach private columns — the RLS check
 * happens in Postgres, not in this component.
 */
export const metadata: Metadata = { title: "Club" };

export default function PublicClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/50" />}>
      <PublicClubView params={params} />
    </Suspense>
  );
}

async function PublicClubView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();

  const liveSessions = await getPublicClubSessions(club.id);
  const active = liveSessions.filter((s) => s.status === "active");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {club.name}
        </h1>
        <p className="text-muted-foreground">
          {club.location ?? `${club.timezone}`}
        </p>
      </header>

      {active.length > 0 ? (
        <section aria-labelledby="live-now" className="flex flex-col gap-3">
          <h2 id="live-now" className="text-lg font-medium">
            Live now
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((session) => (
              <li key={session.id}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Radio className="size-4 text-emerald-600" aria-hidden />
                      <p className="font-medium">{session.name}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Started {formatTime(session.started_at)} UTC
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Scan the session-specific Player Live View QR code from the organizer.
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Nothing is live right now. Check back during open play.
          </CardContent>
        </Card>
      )}

      {liveSessions.length > 0 ? (
        <section aria-labelledby="standings" className="flex flex-col gap-3">
          <h2 id="standings" className="text-lg font-medium">
            Session standings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {liveSessions.slice(0, 2).map((session) => (
              <Suspense key={session.id} fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/50" />}>
                <Standings sessionId={session.id} />
              </Suspense>
            ))}
          </div>
        </section>
      ) : null}

      <div>
        <Button asChild variant="outline">
          <Link href={`/c/${club.slug}/leaderboard`}>
            <Trophy className="mr-2 size-4" aria-hidden />
            All-time leaderboard
          </Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {productConfig.name} shows only what organizers choose to publish.{" "}
        <Link href="/" className="underline underline-offset-4">
          About {productConfig.name}
        </Link>
      </p>
    </div>
  );
}

async function Standings({ sessionId }: { sessionId: string }) {
  // The standings view already aggregates per session and orders by wins, so
  // this table just renders it. All-time ranking lives on the leaderboard page
  // where lib/domain/leaderboard applies the full ordering rules.
  const rows = await getPublicStandings(sessionId);
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No results yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row, index) => (
            <li
              key={row.player_id}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold"
              >
                {initialsOf(row.display_name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {row.display_name}
              </span>
              <Badge variant="secondary">
                <Trophy className="mr-1 size-3" aria-hidden />
                {row.wins}–{row.losses}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
