import { playersPerMatch, type MatchingRules } from "../matching";

export const DEFAULT_MATCH_MINUTES = 15;

export interface WaitEstimateInput {
  /** How many players are ahead in the queue. 0 means "you are up next". */
  playersAhead: number;
  format: MatchingRules["format"];
  /** Courts that are currently available to start a game. */
  availableCourts: number;
  /**
   * Rolling average duration of completed matches. Falls back to
   * DEFAULT_MATCH_MINUTES until enough games have finished.
   */
  rollingAverageMatchMinutes?: number | null;
}

export interface WaitEstimate {
  minutes: number;
  isDefaultDuration: boolean;
  assumedMatchMinutes: number;
}

/**
 * Transparent wait estimate from the SOP:
 *
 *   estimated_wait_minutes =
 *     ceil(players_ahead / players_per_match / available_courts)
 *     * rolling_average_match_minutes
 */
export function estimateWait(input: WaitEstimateInput): WaitEstimate {
  const perMatch = playersPerMatch(input.format);
  const courts = Math.max(1, Math.floor(input.availableCourts || 0));
  const playersAhead = Math.max(0, Math.floor(input.playersAhead || 0));

  const measured = input.rollingAverageMatchMinutes;
  const useDefault =
    measured === null ||
    measured === undefined ||
    !Number.isFinite(measured) ||
    measured <= 0;
  const assumedMatchMinutes = useDefault ? DEFAULT_MATCH_MINUTES : measured;

  const waves = Math.ceil(playersAhead / perMatch / courts);
  const minutes = waves * assumedMatchMinutes;

  return {
    minutes,
    isDefaultDuration: useDefault,
    assumedMatchMinutes,
  };
}

/** Milliseconds a session has been running, used for the live header. */
export function sessionElapsedMinutes(
  startedAt: string | Date | null,
  now: Date = new Date(),
): number {
  if (!startedAt) return 0;
  const start =
    startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 60_000));
}

/** "1h 04m" style elapsed label for the live session header. */
export function formatElapsed(minutes: number): string {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

/** Rolling average of completed match durations, in minutes. */
export function rollingAverageMatchMinutes(
  completedDurationsMs: number[],
  minSamples = 1,
): number | null {
  const usable = completedDurationsMs.filter(
    (ms) => Number.isFinite(ms) && ms > 0,
  );
  if (usable.length < minSamples) return null;
  const total = usable.reduce((sum, ms) => sum + ms, 0);
  return total / usable.length / 60_000;
}
