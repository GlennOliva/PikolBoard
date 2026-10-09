/**
 * Elapsed game time for the live board.
 *
 * Everything here is pure arithmetic on persisted timestamps, with no React and
 * no clock reads of its own beyond the `now` it is handed.
 */

export type MatchTimingStatus = "staged" | "playing" | "completed" | "cancelled";

/** Shown when a playing match has no started_at to count from. */
export const TIMER_UNAVAILABLE = "Timer unavailable";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export function elapsedMs(
  startedAt: string | null | undefined,
  now: number,
): number | null {
  const start = parseTimestamp(startedAt);
  if (start === null) return null;
  return Math.max(0, now - start);
}

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

export function hasUntimedPlayingMatch(params: {
  startedAt: string | null | undefined;
  status: MatchTimingStatus;
}): boolean {
  return params.status === "playing" && parseTimestamp(params.startedAt) === null;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}
