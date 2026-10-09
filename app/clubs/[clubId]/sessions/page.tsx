import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Radio } from "lucide-react";
import { AddSessionPlayers } from "@/components/sessions/add-session-players";
import { CreateSessionForm } from "@/components/sessions/create-session-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClubById, getClubSessions, getRoster } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";
import { formatDateTime, formatSessionWindow } from "@/lib/format";
import type { Session } from "@/lib/db/types";

export const metadata = { title: "Sessions" };

const STATUS_VARIANT: Record<
  Session["status"],
  "default" | "secondary" | "outline"
> = {
  draft: "outline",
  active: "default",
  completed: "secondary",
  cancelled: "outline",
};

export default function SessionsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/50" />}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
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
            <CardHeader>
              <CardTitle className="text-base">New session</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateSessionForm clubId={clubId} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <section aria-labelledby="all-sessions">
        <h2 id="all-sessions" className="text-lg font-medium">
          Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{session.name}</p>
                    <Badge variant={STATUS_VARIANT[session.status]}>
                      {session.status}
                    </Badge>
                    {session.is_public ? (
                      <Badge variant="outline">
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
