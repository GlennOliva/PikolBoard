"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/domain/session/match-timer";

interface SessionElapsedProps {
  startedAt: string | null;
  endedAt: string | null;
}

/**
 * Elapsed wall-clock time for a session that is still running.
 *
 * Hydration safety is the reason this looks the way it does. The server has no
 * idea what time it is on the visitor's device, so it cannot render a duration;
 * if it rendered one anyway the first client frame would differ and React would
 * report a hydration mismatch. `now` therefore starts as null, which renders the
 * `--:--` placeholder on the server and on the first client frame alike. The
 * real clock is read only inside an effect, which React does not run until
 * hydration has finished, so the two trees are byte-identical and the number
 * appears immediately afterwards.
 *
 * A single `now` value rather than a separate "has mounted" flag keeps the two
 * from disagreeing: there is exactly one condition that means "no measurement
 * yet", and it is the same condition the server sees.
 */
export function SessionElapsed({
  startedAt,
  endedAt,
}: SessionElapsedProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt || endedAt) {
      // Nothing to count: either the session never began or its end is already
      // known, in which case the duration is a fixed subtraction below.
      setNow(null);
      return;
    }

    // Read the clock once on mount so the first post-hydration frame shows the
    // true elapsed time rather than waiting a full second for the first tick.
    const update = () => setNow(Date.now());
    update();

    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [startedAt, endedAt]);

  if (!startedAt) {
    return <span className="tabular-nums">Not started</span>;
  }

  const start = Date.parse(startedAt);

  if (!Number.isFinite(start)) {
    return <span className="tabular-nums">Unavailable</span>;
  }

  if (endedAt) {
    const end = Date.parse(endedAt);

    if (!Number.isFinite(end)) {
      return <span className="tabular-nums">Unavailable</span>;
    }

    return (
      <span className="tabular-nums">
        {formatElapsed(Math.max(0, end - start))}
      </span>
    );
  }

  if (now === null) {
    return (
      <span className="tabular-nums" aria-label="Loading elapsed time">
        --:--
      </span>
    );
  }

  return (
    <span className="tabular-nums">
      {formatElapsed(Math.max(0, now - start))}
    </span>
  );
}