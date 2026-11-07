import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import { CourtCard } from "@/components/session/court-card";
import { LiveRefresh } from "@/components/session/live-refresh";
import { LiveBoardQrDialog } from "@/components/session/live-board-qr-dialog";
import { LineupPanels } from "@/components/session/lineup-panels";
import { MatchHistory } from "@/components/session/match-history";
import { Matchmaker } from "@/components/session/matchmaker";
import { QueuePanel } from "@/components/session/queue-panel";
import { SessionControls } from "@/components/session/session-controls";
import { SessionSetup } from "@/components/session/session-setup";
import { StandingsTable } from "@/components/session/standings-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
import { getSessionPageData } from "@/lib/db/queries";
import { canShowPlayerLiveQr } from "@/lib/domain/live-board/live-board-url";
import { canManageClub } from "@/lib/permissions";
import { formatSessionWindow } from "@/lib/format";

export const metadata = { title: "Session" };

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading live session" />}>
      <LiveSession params={params} />
    </Suspense>
  );
}

async function LiveSession({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await getSessionPageData(sessionId);
  if (!data) notFound();

  const { bundle, club, standings, history, availablePlayers } = data;
  const { session, courts, roster, matches } = bundle;

  const canManage = club ? canManageClub(club) : false;
  const rosterEditable =
    canManage && (session.status === "draft" || session.status === "active");

  /*
   * Keyed by players.id, not session_players.id. The lineup RPCs take the club
   * player, and the matchmaker's proposal carries those same ids, so a map keyed
   * by the roster row id missed on every lookup and rendered every proposed player
   * as "Player".
   */
  const playerNames: Record<string, string> = Object.fromEntries(
    roster.map((p) => [p.player_id, p.display_name]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="retro-panel-raised retro-corners flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <Link
            href={`/clubs/${session.club_id}`}
            className="retro-back-link -ml-2 w-fit"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {club?.name ?? "Club"}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="retro-heading text-3xl sm:text-4xl">
              {session.name}
            </h1>
            <Badge
              variant={
                session.status === "active"
                  ? "live"
                  : session.status === "draft"
                    ? "draft"
                    : session.status === "completed"
                      ? "completed"
                      : "danger"
              }
            >
              {session.status}
            </Badge>
            <LiveRefresh sessionId={session.id} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatSessionWindow(session)} · {session.court_count} courts ·{" "}
            {session.format} to {session.target_score}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <SessionControls
            sessionId={session.id}
            status={session.status}
            canManage={canManage}
          />
          {canShowPlayerLiveQr({
            status: session.status,
            enabled: session.player_live_enabled,
            publicToken: session.public_live_token,
          }) && session.public_live_token && club ? (
            <LiveBoardQrDialog
              clubSlug={club.slug}
              publicToken={session.public_live_token}
              sessionName={session.name}
              clubName={club.name}
            />
          ) : null}
          {/* Share and settings are independent: a public session still needs a
              way to reach its settings, and a private one still needs sharing. */}
          {canManage ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/sessions/${session.id}/settings`}>
                <Settings className="mr-2 size-4" aria-hidden />
                Session settings
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {session.status === "draft" ? (
        <p className="rounded-lg border border-pikol-warning/30 bg-pikol-warning/10 px-4 py-3 text-sm text-pikol-warning">
          Start the session to activate the Player Live View and QR code.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="courts" className="flex flex-col gap-4">
          <div>
            <p className="retro-kicker">Court grid</p>
            <h2 id="courts" className="retro-section-title mt-2">
            Courts
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {courts.map((court) => (
              <CourtCard
                key={court.id}
                sessionId={session.id}
                court={court}
                canManage={canManage}
              />
            ))}
          </div>

          {canManage && session.status === "active" ? (
            <Matchmaker
              sessionId={session.id}
              canManage={canManage}
              playerNames={playerNames}
            />
          ) : null}
        </section>

        <section aria-labelledby="queue" className="flex flex-col gap-4">
          <h2 id="queue" className="sr-only">
            Queue and attendance
          </h2>
          {canManage && session.status === "draft" ? (
            <SessionSetup session={session} roster={roster} />
          ) : null}
          <QueuePanel
            sessionId={session.id}
            roster={roster}
            availablePlayers={availablePlayers}
            canManage={rosterEditable}
          />
        </section>
      </div>

      <section aria-labelledby="lineup-pipeline" className="flex flex-col gap-4">
        <h2 id="lineup-pipeline" className="sr-only">
          Lineup pipeline
        </h2>
        <LineupPanels
          sessionId={session.id}
          matches={matches}
          courts={courts}
          roster={roster}
          format={session.format}
          canManage={canManage && session.status === "active"}
        />
      </section>

      <section aria-labelledby="history" className="flex flex-col gap-4">
        <h2 id="history" className="retro-section-title">
          Completed games
        </h2>
        <MatchHistory matches={history} />
      </section>

      <section aria-labelledby="standings" className="flex flex-col gap-4">
        <h2 id="standings" className="retro-section-title">
          Live standings
        </h2>
        {/*
          Rendered whenever anyone has arrived, including before the first match
          is scored. session_standings starts from the checked-in roster, so a
          player with no completed game is a row of zeroes rather than a missing
          row, and hiding the table until someone had played is what made the
          board look broken on a freshly started session.
        */}
        {standings.length === 0 ? (
          <EmptyState
            title="No standings yet"
            body="Nobody has checked in, so there is no standings table to show."
          />
        ) : (
          <StandingsTable
            rows={standings}
            caption={`Session standings for ${session.name}`}
          />
        )}
      </section>
    </div>
  );
}
