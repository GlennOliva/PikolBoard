"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  hasUntimedPlayingMatch,
  timerText,
  type MatchTimingStatus,
} from "@/lib/domain/session/match-timer";
import { cn } from "@/lib/utils";

/**
 * A `now` that only ticks while the match is playing.
 *
 * The source of truth for elapsed time is `matches.started_at`, written once by
 * the database when the match moves to playing. Nothing here writes; the second
 * by second work is a subtraction against a persisted timestamp, so a refresh, a
 * second device, or an organizer on another phone all read the same number.
 *
 * The interval is created only for a playing match and cleared on cleanup and on
 * any status change, so a staged or completed match holds no ticker at all and
 * an unmounted court card cannot keep re-rendering for the rest of the session.
 */
function useMatchClock(
  startedAt: string | null,
  status: MatchTimingStatus,
): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "playing") {
      setNow(null);
      return;
    }

    // Re-sync on mount and on every start change so the first frame after a
    // match begins is not a full second stale.
    const update = () => setNow(Date.now());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [status, startedAt]);

  return now;
}

/**
 * Reports a playing match with no started_at.
 *
 * That is a data-integrity problem, not an empty state: a playing match should
 * always have a start, so it is logged once per occurrence rather than shown as a
 * zeroed clock that would read like a match that just began.
 */
function useReportUntimedMatch(
  startedAt: string | null,
  status: MatchTimingStatus,
): void {
  useEffect(() => {
    if (hasUntimedPlayingMatch({ startedAt, status })) {
      console.error(
        "MatchTimer: a playing match has no started_at, so its elapsed time is unknown.",
        { status },
      );
    }
  }, [startedAt, status]);
}

interface TimerProps {
  startedAt: string | null;
  completedAt?: string | null;
  status: MatchTimingStatus;
  className?: string;
}

/**
 * Compact elapsed time, for places with room for the number alone.
 *
 * A staged match renders nothing: the clock has not begun and "00:00" would be a
 * claim rather than a measurement. A cancelled match says Cancelled instead of
 * freezing on a duration that never happened.
 */
export function MatchTimer({
  startedAt,
  completedAt,
  status,
  className,
}: TimerProps) {
  const now = useMatchClock(startedAt, status);
  useReportUntimedMatch(startedAt, status);

  const text = timerText({ startedAt, completedAt, status, now: now ?? Date.now() });
  if (text === null) return null;

  return (
    <span
      data-testid="match-timer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs tabular-nums",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span className="text-muted-foreground">Game time:</span>
      <span>{text}</span>
    </span>
  );
}

/**
 * Elapsed time on its own line, for the court card body.
 *
 * `tabular-nums` keeps the digits from shifting sideways every second, which is
 * what makes a ticking clock readable rather than jittery on a phone.
 */
export function MatchTimerLabeled({
  startedAt,
  completedAt,
  status,
  className,
}: TimerProps) {
  const now = useMatchClock(startedAt, status);
  useReportUntimedMatch(startedAt, status);

  const text = timerText({ startedAt, completedAt, status, now: now ?? Date.now() });
  if (text === null) return null;

  return (
    <p
      data-testid="match-timer"
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium tabular-nums",
        className,
      )}
    >
      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Game time:</span>
      <span>{text}</span>
    </p>
  );
}