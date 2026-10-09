/**
 * Podium qualification for the live session leaderboard.
 *
 * A podium medal is a claim about a player, not a decoration, so it is gated on a
 * real threshold: five completed games in the current session. Three games and
 * then a single lucky win is not a session's best player, it is a small sample,
 * and colouring that row gold is how a leaderboard loses the trust of the person
 * it is meant to inform.
 *
 * Only completed games count. `session_standings.games_played` is incremented
 * once per finished match by complete_match, and neither a cancelled match nor a
 * staged or playing one touches it, so the running total already excludes them --
 * a cancelled match releases its players with `result = 'cancelled'` and no score
 * write. This module therefore reads games played rather than re-deriving them,
 * so the qualification threshold and the Games column can never disagree.
 *
 * Podium positions are assigned among qualified players only. An unqualified
 * player holding the top line does not take gold away from someone who earned it,
 * which is what makes rule 13 work: the moment a fifth game lands, the podium
 * recomputes and the medals appear without anyone reloading.
 */

import type { StandingTotals } from "@/lib/domain/leaderboard/standing-rows";

/**
 * Completed games needed before official podium highlighting.
 *
 * Overridable per club or per session by changing this constant, or by passing a
 * different `requiredGames` to `qualifyPodium`. Kept as a named constant rather
 * than a literal at each use site so the threshold is one edit, not a search.
 */
export const PODIUM_REQUIRED_GAMES = 5;

/** Only these three places are ever decorated. */
export type PodiumPlace = 1 | 2 | 3;

export const PODIUM_MEDALS: Record<PodiumPlace, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

/** Ordinal label for the rank cell, e.g. "1st". */
export function rankLabel(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

/**
 * How many more completed games this player needs, or 0 when they qualify.
 *
 * Never negative: a player is at the threshold or past it, never above it and
 * still short.
 */
export function gamesToQualify(
  totals: Pick<StandingTotals, "games_played">,
  requiredGames: number = PODIUM_REQUIRED_GAMES,
): number {
  return Math.max(0, requiredGames - totals.games_played);
}

export function isQualified(
  totals: Pick<StandingTotals, "games_played">,
  requiredGames: number = PODIUM_REQUIRED_GAMES,
): boolean {
  return totals.games_played >= requiredGames;
}

/**
 * The qualification cell for one row.
 *
 * "1 more game" is singular and "2 more games" is plural -- the requirement is
 * read once per row, so getting this wrong is noticed immediately.
 */
export function qualificationLabel(
  totals: Pick<StandingTotals, "games_played">,
  requiredGames: number = PODIUM_REQUIRED_GAMES,
): string {
  const remaining = gamesToQualify(totals, requiredGames);
  if (remaining === 0) return "Qualified";
  return remaining === 1
    ? "1 more game to qualify"
    : `${remaining} more games to qualify`;
}

/** The minimal shape this module needs; the standings rows satisfy it. */
export interface PodiumCandidate {
  /** Stable row identity. Also the React key, so it must be unique. */
  playerId: string;
  gamesPlayed: number;
  /** Competition rank as displayed, after any shared-rank handling. */
  rank: number;
}

export interface PodiumRow<T extends PodiumCandidate> {
  row: T;
  qualified: boolean;
  /** null unless this row holds an official podium place. */
  podium: PodiumPlace | null;
  qualificationLabel: string;
  rankLabel: string;
  medal: string | null;
}

/**
 * Attach qualification and podium placement to already-ordered rows.
 *
 * `rows` must arrive in the leaderboard's own display order, with `rank` already
 * resolved. Nothing here re-sorts or re-numbers: the existing ranking order and
 * its shared-rank behaviour are preserved exactly, and this only decides which
 * rows are decorated. Rows are identified by `playerId`, never by position, so a
 * podium recalculation after a new result cannot attach a medal to the wrong
 * person.
 *
 * Medal placement follows position among qualified players, walked in the order
 * the leaderboard already displays them. So one qualified player takes gold, two
 * take gold and silver, and bronze appears only once a third qualifies. Ranking
 * among qualified players uses the leaderboard's own order, which means
 * qualification itself can promote someone: an unqualified player on rank 1
 * cannot take gold away from the best qualified player below them.
 *
 * Shared ranks are preserved untouched. The rank cell keeps showing the
 * competition rank -- two players tied on rank 1 still read "1st" -- while the
 * medal reflects qualified position. Rewriting the rank to match the medal would
 * destroy the tie the ranking deliberately reports, and the requirement is to
 * preserve existing ranking and tie-breaker behaviour, not to rewrite it.
 */
export function qualifyPodium<T extends PodiumCandidate>(
  rows: T[],
  requiredGames: number = PODIUM_REQUIRED_GAMES,
): PodiumRow<T>[] {
  // Position among qualified players, in the leaderboard's own display order.
  // Identified by playerId, never by array index, so a recalculation after a new
  // result cannot move a medal onto a different person.
  const podiumByPlayer = new Map<string, PodiumPlace>();
  let placed = 0;

  for (const row of rows) {
    if (row.gamesPlayed < requiredGames) continue;
    placed += 1;
    if (placed > 3) break;
    podiumByPlayer.set(row.playerId, placed as PodiumPlace);
  }

  return rows.map((row) => {
    const qualified = row.gamesPlayed >= requiredGames;
    const podium = qualified ? (podiumByPlayer.get(row.playerId) ?? null) : null;

    return {
      row,
      qualified,
      podium,
      qualificationLabel: qualificationLabel(
        { games_played: row.gamesPlayed },
        requiredGames,
      ),
      rankLabel: rankLabel(row.rank),
      medal: podium === null ? null : PODIUM_MEDALS[podium],
    };
  });
}