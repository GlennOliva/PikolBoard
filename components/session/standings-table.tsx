import { Card, CardContent } from "@/components/ui/card";
import {
  formatPointDifferential,
  formatRecord,
  pointDifferential,
  winPercent,
} from "@/lib/domain/leaderboard/standing-rows";
import { qualifyPodium, type PodiumPlace } from "@/lib/domain/leaderboard/podium";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The standings table shared by the organizer screen and the public board.
 *
 * Both read models return the same shape (public_session_standings is the
 * publish-gated twin of session_standings), so one table serves both and the
 * columns cannot drift apart between organizer and spectator.
 *
 * Rows come from the database, including players who have not finished a game.
 * That is why Games is shown for everyone and Win % falls back to 0.0%: an
 * arrived player with no games is a genuine zero row, and rendering them as a
 * dash or by hiding the section is what made the board look broken before.
 *
 * Podium highlighting is decoration over an existing order. Nothing here sorts
 * or filters: rows arrive in the standings view's order and keep it, and
 * qualification only decides which of them get a medal. A player short of the
 * threshold stays in the table, in place, with the shortfall spelled out.
 */
export function StandingsTable({
  rows,
  caption,
}: {
  rows: {
    player_id: string;
    display_name: string;
    games_played: number;
    wins: number;
    losses: number;
    points_for: number;
    points_against: number;
  }[];
  caption: string;
}) {
  // Both views return standings already ordered, so the displayed rank is the
  // row position. Computed here rather than fetched, because it is presentation.
  // The original snake_case row is carried through untouched so the shared
  // winPercent / pointDifferential helpers still apply to it directly.
  const decorated = qualifyPodium(
    rows.map((row, index) => ({
      ...row,
      playerId: row.player_id,
      gamesPlayed: row.games_played,
      rank: index + 1,
    })),
  );

  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-2">
                Rank
              </th>
              <th scope="col" className="py-2 pr-2">
                Player
              </th>
              <th scope="col" className="py-2 pr-2">
                Qualification
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                G
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                W
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                L
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                Win %
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                PF
              </th>
              <th scope="col" className="py-2 pr-2 text-right">
                PA
              </th>
              <th scope="col" className="py-2 text-right">
                Diff
              </th>
            </tr>
          </thead>
          <tbody>
            {decorated.map((entry) => {
              const row = entry.row;

              return (
                <tr
                  key={row.playerId}
                  className={cn(
                    "border-b border-border/60 last:border-0",
                    podiumRowClass(entry.podium),
                  )}
                >
                  <td className="py-2 pr-2 tabular-nums">
                    <RankCell
                      medal={entry.medal}
                      label={entry.rankLabel}
                      podium={entry.podium}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold"
                      >
                        {initialsOf(row.display_name)}
                      </span>
                      {row.display_name}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <QualificationBadge
                      qualified={entry.qualified}
                      label={entry.qualificationLabel}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {row.games_played}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{row.wins}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{row.losses}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                    {winPercent(row)}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {row.points_for}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">
                    {row.points_against}
                  </td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {formatPointDifferential(pointDifferential(row))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/**
 * Rank cell: medal, ordinal, and a spoken label.
 *
 * Colour and the emoji glyph are both hidden from assistive tech, so a screen
 * reader hears "1st place, gold" and never "gold", "1st", or nothing at all. The
 * visible ordinal is hidden too when a medal is present, because the sr-only
 * label already contains the place -- otherwise it is announced twice.
 */
function RankCell({
  medal,
  label,
  podium,
}: {
  medal: string | null;
  label: string;
  podium: PodiumPlace | null;
}) {
  if (podium === null) {
    return <span className="text-muted-foreground">{label}</span>;
  }

  return (
    <span className="flex items-center gap-1.5 font-semibold">
      <span className="sr-only">{podiumPlaceName(podium)}</span>
      <span aria-hidden className="text-base leading-none">
        {medal}
      </span>
      <span aria-hidden>{label}</span>
    </span>
  );
}

function podiumPlaceName(podium: PodiumPlace | null): string {
  if (podium === 1) return "1st place, gold";
  if (podium === 2) return "2nd place, silver";
  return "3rd place, bronze";
}

/**
 * Podium row tint.
 *
 * Muted enough to sit behind table text without fighting it, and paired with the
 * medal and rank label so the distinction survives greyscale, colour blindness,
 * and dark mode. The left border is a second non-colour cue for the same three
 * tiers.
 */
function podiumRowClass(podium: PodiumPlace | null): string {
  if (podium === 1) return "bg-amber-500/10 border-l-2 border-l-amber-500";
  if (podium === 2) return "bg-slate-400/10 border-l-2 border-l-slate-400";
  if (podium === 3) return "bg-orange-700/10 border-l-2 border-l-orange-700";
  return "";
}

/**
 * Qualification cell.
 *
 * Qualified rows get a quiet affirmative badge; everyone else gets the exact
 * number of games still needed, singular or plural, so nobody has to infer
 * progress from the medal column.
 */
function QualificationBadge({
  qualified,
  label,
}: {
  qualified: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
        qualified
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "text-muted-foreground",
      )}
    >
      {qualified ? <span className="sr-only">Podium status: </span> : null}
      {label}
    </span>
  );
}

/**
 * Compact record badge for places with room for one number, such as a court
 * card footer. Kept next to the table so "2–1" always means the same thing.
 */
export function StandingRecord({
  wins,
  losses,
}: {
  wins: number;
  losses: number;
}) {
  return <span className="tabular-nums">{formatRecord(wins, losses)}</span>;
}