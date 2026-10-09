/**
 * Display shaping for the live session board.
 *
 * The standings views deliberately return integers and NULL timestamps, never
 * pre-formatted strings, so the database stays the source of truth for the
 * numbers. Everything in this module is presentation only.
 */

/** The columns these helpers read. Both standings views return this shape. */
export interface StandingTotals {
  games_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
}

/** Exact win ratio, 0 when nobody has played. Never rounds. */
export function winRatio(totals: StandingTotals): number {
  return totals.games_played === 0 ? 0 : totals.wins / totals.games_played;
}

/** Win percentage for display. A player with no games is 0%, not NaN. */
export function winPercent(totals: StandingTotals): string {
  return `${(winRatio(totals) * 100).toFixed(1)}%`;
}

export function pointDifferential(totals: StandingTotals): number {
  return totals.points_for - totals.points_against;
}

/**
 * Signed differential for display. Zero is bare "0" rather than "+0".
 */
export function formatPointDifferential(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** "2–1", using the en dash the rest of the board uses. */
export function formatRecord(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}
