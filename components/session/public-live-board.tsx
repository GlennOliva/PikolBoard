import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveBoardQueue } from "@/components/session/live-board-queue";
import { MatchTimerLabeled } from "@/components/session/match-timer";
import { PublicLiveRefresh } from "@/components/session/public-live-refresh";
import { SessionElapsed } from "@/components/session/session-elapsed";
import { StandingsTable } from "@/components/session/standings-table";
import {
  LineupCards,
  type LineupCardGroup,
} from "@/components/session/up-next";
import type {
  PublicLineupSection,
  PublicLiveCourt,
  PublicLiveSession,
  PublicMatchLineupRow,
  PublicSessionPresenceRow,
  PublicSessionStanding,
} from "@/lib/db/types";

export function PublicLiveBoard({
  session,
  courts,
  lineups,
  upNext,
  preparation,
  presence,
  standings,
}: {
  session: PublicLiveSession;
  courts: PublicLiveCourt[];
  lineups: PublicMatchLineupRow[];
  upNext: PublicLineupSection[];
  preparation: PublicLineupSection[];
  presence: PublicSessionPresenceRow[];
  standings: PublicSessionStanding[];
}) {
  const playing = courts.filter((court) => court.match_status === "playing");
  const staged = courts.filter((court) => court.match_status === "staged");
  const completed = session.status === "completed";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-muted/30 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{session.club_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">{session.name}</h1>
                <Badge variant={completed ? "secondary" : "default"}>{completed ? "ENDED" : "LIVE"}</Badge>
              </div>
            </div>
            <PublicLiveRefresh sessionId={session.id} />
          </div>

          {completed ? (
            <p className="mt-4 rounded-lg border bg-background/70 p-3 text-sm font-medium">
              <span className="block">Session completed</span>
              <span className="text-muted-foreground">Final results are shown below.</span>
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <HeaderFact label="Format" value={titleCase(session.format)} />
          <HeaderFact label="Matching" value={titleCase(session.matching_mode)} />
          <HeaderFact label="Courts" value={String(session.court_count)} />
          <div className="bg-card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Session time</dt>
            <dd className="mt-1 font-medium"><SessionElapsed startedAt={session.started_at} endedAt={session.ended_at} /></dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="live-courts" className="flex flex-col gap-3" data-live-board-section="courts">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">On court</p>
          <h2 id="live-courts" className="text-xl font-semibold">Live Courts</h2>
        </div>
        {playing.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="font-medium">No match is currently playing.</p>
              <p className="mt-1 text-sm text-muted-foreground">Check Up Next to see who will play next.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {playing.map((court) => (
              <LiveCourt key={court.court_number} court={court} lineups={lineups} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="ready-on-court" className="flex flex-col gap-3" data-live-board-section="ready">
        <h2 id="ready-on-court" className="text-xl font-semibold">Ready on Court</h2>
        <LineupCards
          groups={stagedCourtGroups(staged, lineups)}
          emptyText="No lineup is waiting on a court."
        />
      </section>

      <section aria-labelledby="up-next" className="flex flex-col gap-3" data-live-board-section="up-next">
        <h2 id="up-next" className="text-xl font-semibold">Up Next</h2>
        <LineupCards
          groups={queuedGroups(upNext)}
          emptyText="The organizer is preparing the next matchup."
        />
      </section>

      <section aria-labelledby="preparation" className="flex flex-col gap-3" data-live-board-section="preparation">
        <h2 id="preparation" className="text-xl font-semibold">Preparation</h2>
        <LineupCards
          groups={queuedGroups(preparation)}
          emptyText="No additional lineups are being prepared."
        />
      </section>

      <section aria-labelledby="waiting-queue" className="flex flex-col gap-3" data-live-board-section="queue">
        <div>
          <h2 id="waiting-queue" className="text-xl font-semibold">Waiting Queue</h2>
          <p className="text-sm text-muted-foreground">
            Estimates use {session.avg_match_minutes ?? 15} minutes per game across {session.court_count} court{session.court_count === 1 ? "" : "s"}.
          </p>
        </div>
        <LiveBoardQueue rows={presence} courtCount={session.court_count} averageMatchMinutes={session.avg_match_minutes} />
      </section>

      <section aria-labelledby="leaderboard" className="flex flex-col gap-3" data-live-board-section="leaderboard">
        <div>
          <h2 id="leaderboard" className="text-xl font-semibold">Live Leaderboard</h2>
          <p className="text-sm text-muted-foreground">Five completed games qualify a player for the podium.</p>
        </div>
        {standings.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">Nobody is on the session roster yet.</CardContent></Card>
        ) : (
          <StandingsTable rows={standings} caption={`Live leaderboard for ${session.name}`} />
        )}
      </section>
    </div>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return <div className="bg-card p-4"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function queuedGroups(lineups: PublicLineupSection[]): LineupCardGroup[] {
  return lineups.map((lineup) => ({
    id: lineup.match_id,
    label: lineup.display_name,
    players: lineup.players,
  }));
}

function stagedCourtGroups(
  courts: PublicLiveCourt[],
  lineups: PublicMatchLineupRow[],
): LineupCardGroup[] {
  return courts.map((court) => {
    const matchLabel =
      court.display_name?.trim() ||
      (court.match_number == null ? "Lineup" : `Match ${court.match_number}`);
    return {
      id: `court-${court.court_number}-match-${court.match_number ?? "unknown"}`,
      label: `${matchLabel} · Court ${court.court_number}`,
      players: lineups.filter((row) => row.court_number === court.court_number),
    };
  });
}

function LiveCourt({ court, lineups }: { court: PublicLiveCourt; lineups: PublicMatchLineupRow[] }) {
  const rows = lineups.filter((row) => row.court_number === court.court_number);
  const team = (number: 1 | 2) => rows.filter((row) => row.team_number === number).sort((a, b) => a.slot_number - b.slot_number);

  return (
    <Card className="overflow-hidden border-emerald-500/30">
      <CardHeader className="flex-row items-center justify-between border-b bg-emerald-500/5 pb-4">
        <CardTitle>{`Court ${court.court_number}${court.court_name ? ` · ${court.court_name}` : ""}`}</CardTitle>
        <Badge>Playing</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <PublicTeam label="Team 1" rows={team(1)} align="right" />
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">{court.team1_score ?? 0}<span className="mx-1 text-muted-foreground">–</span>{court.team2_score ?? 0}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Current score</p>
          </div>
          <PublicTeam label="Team 2" rows={team(2)} align="left" />
        </div>
        <div className="flex items-center justify-between border-t pt-4 text-sm">
          <span className="text-muted-foreground">First to {court.target_score ?? "—"}</span>
          <MatchTimerLabeled startedAt={court.match_started_at} completedAt={court.match_completed_at} status="playing" />
        </div>
      </CardContent>
    </Card>
  );
}

function PublicTeam({ label, rows, align }: { label: string; rows: PublicMatchLineupRow[]; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold leading-snug">
        {rows.length === 0 ? "Lineup pending" : rows.map((row, index) => (
          <span key={row.lineup_id}>{index > 0 ? " + " : ""}{row.display_name}</span>
        ))}
      </p>
    </div>
  );
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
