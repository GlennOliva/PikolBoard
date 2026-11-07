import { Badge } from "@/components/ui/badge";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveBoardQueue } from "@/components/session/live-board-queue";
import { MatchTimerLabeled } from "@/components/session/match-timer";
import { PublicLiveRefresh } from "@/components/session/public-live-refresh";
import { SessionElapsed } from "@/components/session/session-elapsed";
import { StandingsTable } from "@/components/session/standings-table";
import {
  LineupCards,
  type LineupCardGroup,
} from "@/components/session/up-next";
import { CheckCircle2, Link2, ListOrdered, MonitorOff, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PublicLineupSection,
  PublicLiveCourt,
  PublicLiveSession,
  PublicMatchLineupRow,
  PublicPartnerLock,
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
  partnerLocks = [],
}: {
  session: PublicLiveSession;
  courts: PublicLiveCourt[];
  lineups: PublicMatchLineupRow[];
  upNext: PublicLineupSection[];
  preparation: PublicLineupSection[];
  presence: PublicSessionPresenceRow[];
  standings: PublicSessionStanding[];
  partnerLocks?: PublicPartnerLock[];
}) {
  const playing = courts.filter((court) => court.match_status === "playing");
  const staged = courts.filter((court) => court.match_status === "staged");
  const completed = session.status === "completed";

  return (
    <div
      className="retro-public-board mx-auto flex w-full max-w-7xl flex-col gap-8"
      data-public-board="true"
    >
      <header
        className="retro-panel-raised retro-corners retro-hud overflow-hidden"
        data-live-board-section="summary"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pikol-border/60 px-5 py-3 sm:px-7">
          <PikolgoLogo priority sizes="160px" className="h-8" />
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            <span className="retro-kicker">Player live view</span>
            <PublicLiveRefresh sessionId={session.id} />
          </div>
        </div>

        <div className="relative overflow-hidden border-b border-pikol-border/60 p-5 sm:p-7">
          <div
            aria-hidden
            className="retro-grid-card pointer-events-none absolute inset-0 opacity-[0.06]"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-pikol-cyan">
                {session.club_name}
              </p>
              <h1 className="retro-heading text-glow mt-2 max-w-3xl text-3xl leading-[1.02] sm:text-5xl">
                {session.name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {completed ? (
                  <Badge variant="completed">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    ENDED
                  </Badge>
                ) : (
                  <Badge variant="on-air" className="retro-on-air">
                    <span className="retro-live-dot" aria-hidden />
                    LIVE
                  </Badge>
                )}
                <span className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
                  {completed ? "Session closed" : "Session in progress"}
                </span>
              </div>
            </div>
          </div>

          {completed ? (
            <p className="relative mt-4 rounded-lg border border-pikol-cyan/30 bg-pikol-cyan/5 p-3 text-sm font-medium">
              <span className="block text-pikol-cyan">Session completed</span>
              <span className="text-muted-foreground">
                Final results are shown below.
              </span>
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-px bg-pikol-border/60 sm:grid-cols-4">
          <HeaderFact label="Format" value={titleCase(session.format)} />
          <HeaderFact label="Matching" value={titleCase(session.matching_mode)} />
          <HeaderFact label="Courts" value={String(session.court_count)} />
          <div className="bg-card/90 p-4">
            <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Session time
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">
              <SessionElapsed
                startedAt={session.started_at}
                endedAt={session.ended_at}
              />
            </dd>
          </div>
        </dl>
      </header>

      {partnerLocks.length > 0 ? (
        <section
          aria-labelledby="public-partner-locks"
          className="flex flex-col gap-4"
          data-live-board-section="partner-locks"
        >
          <div>
            <p className="retro-kicker">Playing together</p>
            <h2
              id="public-partner-locks"
              className="retro-section-title mt-2 text-xl sm:text-2xl"
            >
              Partner Locks
            </h2>
          </div>
          <Card className="retro-preparing">
            <CardContent className="pt-5 sm:pt-6">
              <ul className="grid gap-3 sm:grid-cols-2">
                {partnerLocks.map((lock, index) => (
                  <li
                    key={`${lock.display_name_a}:${lock.display_name_b}:${index}`}
                    className="flex items-center gap-3 rounded-lg border border-pikol-purple/35 bg-pikol-purple/10 px-3 py-3"
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-md border border-pikol-purple/40 text-pikol-purple"
                      aria-hidden
                    >
                      <Link2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {lock.display_name_a} + {lock.display_name_b}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Levels {lock.skill_level_a} + {lock.skill_level_b} · same team
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section
        aria-labelledby="live-courts"
        className="flex flex-col gap-4"
        data-live-board-section="courts"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="retro-kicker">On court</p>
            <h2
              id="live-courts"
              className="retro-section-title mt-2 text-xl sm:text-2xl"
            >
              Live Courts
            </h2>
          </div>
          {playing.length > 0 ? (
            <Badge variant="on-air" className="retro-on-air">
              <span className="retro-live-dot" aria-hidden />
              {playing.length} LIVE
            </Badge>
          ) : null}
        </div>
        {playing.length === 0 ? (
          <EmptyState
            icon={<MonitorOff className="size-5" />}
            title="No match is currently playing."
            body="Check Up Next to see who will play next, or wait for the organizer to start a court."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {playing.map((court) => (
              <LiveCourt
                key={court.court_number}
                court={court}
                lineups={lineups}
              />
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="ready-on-court"
        className="flex flex-col gap-4"
        data-live-board-section="ready"
      >
        <div>
          <p className="retro-kicker">Next on deck</p>
          <h2
            id="ready-on-court"
            className="retro-section-title mt-2 text-xl sm:text-2xl"
          >
            Ready on Court
          </h2>
        </div>
        <LineupCards
          groups={stagedCourtGroups(staged, lineups)}
          emptyText="No lineup is waiting on a court."
          tone="staged"
        />
      </section>

      <section
        aria-labelledby="up-next"
        className="flex flex-col gap-4"
        data-live-board-section="up-next"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="retro-kicker">Queued</p>
            <h2
              id="up-next"
              className="retro-section-title mt-2 text-xl text-pikol-primary sm:text-2xl"
            >
              Up Next
            </h2>
          </div>
          <span className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
            {upNext.length} {upNext.length === 1 ? "lineup" : "lineups"}
          </span>
        </div>
        <LineupCards
          groups={queuedGroups(upNext)}
          emptyText="The organizer is preparing the next matchup."
          tone="up-next"
        />
      </section>

      <section
        aria-labelledby="preparation"
        className="flex flex-col gap-4"
        data-live-board-section="preparation"
      >
        <div>
          <p className="retro-kicker">Build queue</p>
          <h2
            id="preparation"
            className="retro-section-title mt-2 text-xl text-pikol-pink sm:text-2xl"
          >
            Preparation
          </h2>
        </div>
        <LineupCards
          groups={queuedGroups(preparation)}
          emptyText="No additional lineups are being prepared."
          tone="preparing"
        />
      </section>

      <section
        aria-labelledby="waiting-queue"
        className="flex flex-col gap-4"
        data-live-board-section="queue"
      >
        <div>
          <p className="retro-kicker">Rotation</p>
          <h2
            id="waiting-queue"
            className="retro-section-title mt-2 text-xl sm:text-2xl"
          >
            Waiting Queue
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Estimates use {session.avg_match_minutes ?? 15} minutes per game
            across {session.court_count} court
            {session.court_count === 1 ? "" : "s"}.
          </p>
        </div>
        <LiveBoardQueue
          rows={presence}
          courtCount={session.court_count}
          averageMatchMinutes={session.avg_match_minutes}
        />
      </section>

      <section
        aria-labelledby="leaderboard"
        className="flex flex-col gap-4"
        data-live-board-section="leaderboard"
      >
        <div>
          <p className="retro-kicker">Standings</p>
          <h2
            id="leaderboard"
            className="retro-section-title mt-2 text-xl sm:text-2xl"
          >
            Live Leaderboard
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Five completed games qualify a player for the podium.
          </p>
        </div>
        {standings.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-5" />}
            title="Nobody is on the session roster yet."
            body="Standings appear as soon as players are checked in and finish their first game."
          />
        ) : (
          <StandingsTable
            rows={standings}
            caption={`Live leaderboard for ${session.name}`}
          />
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ListOrdered className="size-4 text-pikol-cyan" aria-hidden />
        This board is read-only and updates automatically.
      </p>
    </div>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/90 p-4">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
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
      (court.match_number == null
        ? "Lineup"
        : `Match ${court.match_number}`);
    return {
      id: `court-${court.court_number}-match-${court.match_number ?? "unknown"}`,
      label: `${matchLabel} · Court ${court.court_number}`,
      players: lineups.filter(
        (row) => row.court_number === court.court_number,
      ),
    };
  });
}

function LiveCourt({
  court,
  lineups,
}: {
  court: PublicLiveCourt;
  lineups: PublicMatchLineupRow[];
}) {
  const rows = lineups.filter(
    (row) => row.court_number === court.court_number,
  );
  const team = (number: 1 | 2) =>
    rows
      .filter((row) => row.team_number === number)
      .sort((a, b) => a.slot_number - b.slot_number);

  return (
    <Card
      className="retro-court-panel overflow-hidden"
      data-testid={`public-live-court-${court.court_number}`}
    >
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 border-b border-pikol-border/60 bg-pikol-cyan/5 pb-4">
        <div>
          <CardTitle className="text-lg sm:text-xl">{`Court ${court.court_number}${court.court_name ? ` · ${court.court_name}` : ""}`}</CardTitle>
          {court.display_name ? (
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
              {court.display_name}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant="on-air" className="retro-on-air">
            <span className="retro-live-dot" aria-hidden />
            LIVE
          </Badge>
          <MatchTimerLabeled
            startedAt={court.match_started_at}
            completedAt={court.match_completed_at}
            status="playing"
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <PublicTeam label="Team 1" rows={team(1)} align="right" />
          <div className="rounded-xl border border-pikol-border/70 bg-background/40 px-4 py-2 text-center">
            <p className="text-3xl font-bold tabular-nums sm:text-4xl">
              {court.team1_score ?? 0}
              <span className="mx-1 text-muted-foreground">–</span>
              {court.team2_score ?? 0}
            </p>
            <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current score
            </p>
          </div>
          <PublicTeam label="Team 2" rows={team(2)} align="left" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-pikol-border/60 pt-4 text-sm">
          <span className="text-muted-foreground">
            First to{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {court.target_score ?? "—"}
            </span>
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
            {titleCase(court.court_status)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicTeam({
  label,
  rows,
  align,
}: {
  label: string;
  rows: PublicMatchLineupRow[];
  align: "left" | "right";
}) {
  const teamOne = label === "Team 1";

  return (
    <div
      className={cn(
        "min-w-0",
        align === "right" ? "text-left sm:text-right" : "text-left",
      )}
    >
      <p
        className={cn(
          "text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
          teamOne ? "text-pikol-cyan" : "text-pikol-pink",
        )}
      >
        {label}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">Lineup pending</li>
        ) : (
          rows.map((row) => (
            <li key={row.lineup_id} className="text-sm font-semibold leading-snug">
              {row.display_name}
            </li>
          ))
        )}
      </ul>
      <span
        aria-hidden
        className={cn(
          "mt-2 block h-0.5 w-8",
          teamOne ? "bg-pikol-cyan" : "bg-pikol-pink",
          align === "right" ? "sm:ml-auto" : "",
        )}
      />
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
