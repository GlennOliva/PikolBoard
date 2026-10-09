import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatElapsed, durationMs } from "@/lib/domain/session/match-timer";
import type { MatchWithPlayers } from "@/lib/db/queries";

/**
 * Completed matches for this session, newest first, each with its final duration.
 *
 * A finished game has a settled duration, not a running clock, so this formats
 * the stored timestamps directly rather than mounting a ticker per row. Rows
 * whose start was never recorded show the same "Timer unavailable" fallback the
 * live court card uses, rather than a plausible-looking guess.
 */
export function MatchHistory({ matches }: { matches: MatchWithPlayers[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Completed games</CardTitle>
      </CardHeader>
      <CardContent className={matches.length === 0 ? "py-6 text-sm text-muted-foreground" : "p-0"}>
        {matches.length === 0 ? (
          <p>
            No games have been finished yet. Results appear here with their final
            duration as soon as a score is recorded.
          </p>
        ) : (
          <ul>
            {matches.map((match) => {
              const duration = durationMs(match.started_at, match.completed_at);

              return (
                <li
                  // One row per completed match; match.id is the row identity.
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border/60 px-4 py-2 text-sm last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {match.court_name
                        ? `Court ${match.court_number} · ${match.court_name}`
                        : `Court ${match.court_number}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {match.winning_team === 1
                        ? `Team 1 won ${match.team1_score}–${match.team2_score}`
                        : `Team 2 won ${match.team2_score}–${match.team1_score}`}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Game time: {formatElapsed(duration)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}