import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Radio } from "lucide-react";
import { AddSessionPlayers } from "@/components/sessions/add-session-players";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getClubById, getClubSessions, getRoster } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";
import { formatDateTime, formatSessionWindow } from "@/lib/format";
import type { Session } from "@/lib/db/types";

export const metadata = { title: "Sessions" };

const STATUS_VARIANT: Record<
  Session["status"],
  "draft" | "live" | "completed" | "danger"
> = {
  draft: "draft",
  active: "live",
  completed: "completed",
  cancelled: "danger",
};

export default function SessionsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  return (
    <Suspense
      fallback={<PageSkeleton label="Loading sessions" />}
    >
      <Sessions params={params} />
    </Suspense>
  );
}

async function Sessions({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = await getClubById(clubId);
  if (!club) notFound();

  const [sessions, roster] = await Promise.all([
    getClubSessions(clubId),
    getRoster(clubId),
  ]);
  const canManage = canManageClub(club);
  const activePlayers = roster.filter((p) => p.is_active);

  return (
    <div className="flex flex-col gap-8">
      {canManage ? (
        <>
          {activePlayers.length > 0 ? (
            <Card className="border-pikol-cyan/25">
              <CardHeader className="border-b border-border/60">
                <p className="retro-kicker">Fast add</p>
                <CardTitle className="text-lg">
                  Add players to a session
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddSessionPlayers
                  clubId={clubId}
                  players={activePlayers.map((p) => ({
                    id: p.id,
                    display_name: p.display_name,
                  }))}
                  sessions={sessions.map((s) => ({
                    id: s.id,
                    name: s.name,
                    status: s.status,
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b border-border/60">
              <p className="retro-kicker">Session builder</p>
              <CardTitle className="text-lg">New session</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateSessionForm clubId={clubId} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <section aria-labelledby="all-sessions">
        <h2 id="all-sessions" className="retro-section-title">
          Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="No sessions yet"
            body="Create the first session above, then add players and start the live rotation."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/65 px-4 py-3 transition-colors hover:border-pikol-cyan/35"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{session.name}</p>
                    <Badge variant={STATUS_VARIANT[session.status]}>
                      {session.status}
                    </Badge>
                    {session.is_public ? (
                      <Badge variant="success">
                        <Radio className="mr-1 size-3" aria-hidden />
                        public
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatSessionWindow(session)} ·{" "}
                    {formatDateTime(session.created_at)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/sessions/${session.id}`}>
                    Open
                    <ArrowRight className="ml-2 size-4" aria-hidden />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
