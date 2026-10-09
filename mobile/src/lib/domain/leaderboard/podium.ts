/**
 * Podium qualification for the live session leaderboard.
 *
 * A podium medal is gated on a real threshold: five completed games in the
 * current session. Only completed games count.
 */

import type { StandingTotals } from "./standing-rows";

/**
 * Completed games needed before official podium highlighting.
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
 * Rows must arrive in the leaderboard's own display order, with `rank` already
 * resolved. Nothing here re-sorts or re-numbers.
 */
export function qualifyPodium<T extends PodiumCandidate>(
  rows: T[],
  requiredGames: number = PODIUM_REQUIRED_GAMES,
): PodiumRow<T>[] {
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
