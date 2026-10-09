/**
 * Display shaping for the live session board.
 *
 * The standings views deliberately return integers and NULL timestamps, never
 * pre-formatted strings, so the database stays the source of truth for the
 * numbers. Everything in this module is presentation only.
 *
 * The zero-game case is the whole point of the live board: a player who has
 * checked in but not yet finished a match is a row of zeroes, and these helpers
 * must render that as "0", "0%", and a zero differential rather than as a dash
 * or a blank that reads like missing data.
 *
 * The field names match the session_standings / public_session_standings views
 * exactly so a row can be passed straight in without a mapping layer. Sorting
 * and ranking live in lib/domain/leaderboard/rank-players; this module never
 * reorders anything.
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
 * Signed differential for display. Zero is bare "0" rather than "+0", which
 * would read as a rounding artefact instead of a genuinely even record.
 */
export function formatPointDifferential(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** "2–1", using the en dash the rest of the board uses. */
export function formatRecord(wins: number, losses: number): string {
  return `${wins}–${losses}`;
}