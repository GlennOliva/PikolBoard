import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getClubById, getClubSessions, getRoster } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";
import { formatSessionWindow } from "@/lib/format";

export const metadata = { title: "Club" };

export default function ClubOverviewPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  return (
    <Suspense
      fallback={<PageSkeleton label="Loading club overview" />}
    >
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = await getClubById(clubId);
  if (!club) notFound();

  const [sessions, roster] = await Promise.all([
    getClubSessions(clubId),
    getRoster(clubId),
  ]);

  const live = sessions.filter((s) => s.status === "active");
  const canManage = canManageClub(club);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
        <Card className="retro-grid-card">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.1em] text-muted-foreground">Roster</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-4xl font-semibold tabular-nums text-pikol-cyan">{roster.length}</p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/clubs/${clubId}/players`}>
                <Users className="mr-2 size-4" aria-hidden />
                Manage
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={live.length > 0 ? "border-pikol-cyan/35" : undefined}>
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.1em] text-muted-foreground">Live now</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-4xl font-semibold tabular-nums text-pikol-cyan">{live.length}</p>
            {live.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-2">
                {live.map((s) => (
                  <Button key={s.id} asChild size="sm">
                    <Link href={`/sessions/${s.id}`}>
                      {s.name}
                      <ArrowRight className="ml-2 size-4" aria-hidden />
                    </Link>
                  </Button>
                ))}
              </div>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={`/clubs/${clubId}/sessions`}>
                  <CalendarDays className="mr-2 size-4" aria-hidden />
                  Sessions
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {club.is_public ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              This club&apos;s live board is public. Anyone with the link or QR
              code can watch courts and standings without an account.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/c/${club.slug}`}>
                <QrCode className="mr-2 size-4" aria-hidden />
                Public board
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="recent-sessions" className="flex flex-col gap-3">
        <h2 id="recent-sessions" className="retro-section-title">
          Recent sessions
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            body="Create a session to check players in, build matches, and open the live board."
            action={canManage ? (
              <Link
                href={`/clubs/${clubId}/sessions`}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                Create the first session
              </Link>
            ) : undefined}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.slice(0, 5).map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/65 px-4 py-3 transition-colors hover:border-pikol-cyan/35"
              >
                <div>
                  <p className="font-medium">{session.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSessionWindow(session)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/sessions/${session.id}`}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
