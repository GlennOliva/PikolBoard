import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/50" />}
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roster</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-3xl font-semibold">{roster.length}</p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/clubs/${clubId}/players`}>
                <Users className="mr-2 size-4" aria-hidden />
                Manage
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live now</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-3xl font-semibold">{live.length}</p>
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

      <section aria-labelledby="recent-sessions">
        <h2 id="recent-sessions" className="text-lg font-medium">
          Recent sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No sessions yet.{" "}
            {canManage ? (
              <Link
                href={`/clubs/${clubId}/sessions`}
                className="underline underline-offset-4"
              >
                Start one
              </Link>
            ) : null}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {sessions.slice(0, 5).map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
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
