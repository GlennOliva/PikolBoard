/**
 * Elapsed game time for the live board.
 *
 * Everything here is pure arithmetic on persisted timestamps, with no React and
 * no clock reads of its own beyond the `now` it is handed. That split is the
 * whole point of the feature: `matches.started_at` is written once by the
 * database when the match starts, so every device computes the same elapsed
 * time from the same row. A timer kept in component state would read as correct
 * on the device that staged the match and wrong everywhere else, and a refresh
 * would restart it from zero.
 *
 * The caller ticks once a second and passes the new `now` in. Nothing here writes.
 */

export type MatchTimingStatus = "staged" | "playing" | "completed" | "cancelled";

/** Shown when a playing match has no started_at to count from. */
export const TIMER_UNAVAILABLE = "Timer unavailable";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/**
 * Milliseconds since `startedAt`, or null when there is no usable start.
 *
 * A negative result is clamped to zero rather than rendered as a negative
 * duration. The database now prevents completed_at < started_at, but a clock
 * skewed between the server and this browser can still produce a start a moment
 * in the future, and "-00:03" is a worse thing to put on a scoreboard than
 * "00:00".
 */
export function elapsedMs(
  startedAt: string | null | undefined,
  now: number,
): number | null {
  const start = parseTimestamp(startedAt);
  if (start === null) return null;
  return Math.max(0, now - start);
}

/**
 * Milliseconds a finished match took, or null when either end is missing.
 *
 * A completed match with a null started_at predates started_at being populated;
 * its duration is genuinely unknown, so this returns null and the caller renders
 * the fallback rather than a plausible-looking guess.
 */
export function durationMs(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
): number | null {
  const start = parseTimestamp(startedAt);
  const end = parseTimestamp(completedAt);
  if (start === null || end === null) return null;
  return Math.max(0, end - start);
}

/**
 * Format a duration as MM:SS, or H:MM:SS from one hour up.
 *
 *   0        -> 00:00
 *   324_000  -> 05:24
 *   3_599_000 -> 59:59
 *   3_932_000 -> 1:05:32
 *
 * Minutes are not capped at 59 in the MM:SS form because that form is only
 * reached below an hour, where they cannot exceed 59 anyway. Hours are not
 * padded, so a 12-hour session reads "12:04:31" rather than "012:04:31".
 */
export function formatElapsed(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return TIMER_UNAVAILABLE;
  const total = Math.max(0, Math.floor(ms));
  const hours = Math.floor(total / MS_PER_HOUR);
  const minutes = Math.floor((total % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((total % MS_PER_MINUTE) / MS_PER_SECOND);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * The number a running timer should show right now, and whether it is knowable.
 *
 * Status decides which pair of timestamps is meaningful:
 *   playing    -> now - started_at, ticking
 *   completed  -> completed_at - started_at, frozen
 *   staged     -> nothing yet; the match has not started
 *   cancelled  -> nothing; the match will never finish
 */
export function timerValue({
  startedAt,
  completedAt,
  status,
  now,
}: {
  startedAt: string | null | undefined;
  completedAt?: string | null;
  status: MatchTimingStatus;
  now: number;
}): number | null {
  if (status === "playing") return elapsedMs(startedAt, now);
  if (status === "completed") return durationMs(startedAt, completedAt ?? null);
  return null;
}

/**
 * What the timer should read for a match in this state.
 *
 * Returns null when there is genuinely nothing to say (staged, cancelled), so
 * the caller can render nothing at all rather than an empty shell.
 */
export function timerText(params: {
  startedAt: string | null | undefined;
  completedAt?: string | null;
  status: MatchTimingStatus;
  now: number;
}): string | null {
  const { status } = params;
  if (status === "cancelled") return "Cancelled";
  if (status === "staged") return null;
  return formatElapsed(timerValue(params));
}

/**
 * True when the match is playing but has no start to count from.
 *
 * This is a data-integrity signal, not a display state: a playing match should
 * always have started_at, so the caller reports it rather than quietly showing
 * a zeroed timer that looks like a brand new game.
 */
export function hasUntimedPlayingMatch(params: {
  startedAt: string | null | undefined;
  status: MatchTimingStatus;
}): boolean {
  return params.status === "playing" && parseTimestamp(params.startedAt) === null;
}

/** Timestamp to milliseconds, or null for absent and unparseable input. */
function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}