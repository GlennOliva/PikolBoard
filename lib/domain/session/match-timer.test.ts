import { describe, expect, it } from "vitest";
import {
  TIMER_UNAVAILABLE,
  durationMs,
  elapsedMs,
  formatElapsed,
  hasUntimedPlayingMatch,
  timerText,
  timerValue,
} from "./match-timer";

/** 2026-03-01T10:00:00.000Z, the base every test offsets from. */
const BASE = Date.UTC(2026, 2, 1, 10, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

describe("formatElapsed under one minute", () => {
  it("renders zero as 00:00", () => {
    expect(formatElapsed(0)).toBe("00:00");
  });

  it("pads both minutes and seconds", () => {
    expect(formatElapsed(5_000)).toBe("00:05");
    expect(formatElapsed(65_000)).toBe("01:05");
  });

  it("renders the documented 05:24", () => {
    expect(formatElapsed(324_000)).toBe("05:24");
  });

  it("does not roll over a minute early", () => {
    expect(formatElapsed(59_999)).toBe("00:59");
    expect(formatElapsed(60_000)).toBe("01:00");
  });

  it("renders the documented 59:59 at the last second of an hour", () => {
    expect(formatElapsed(3_599_000)).toBe("59:59");
  });
});

describe("formatElapsed over one hour", () => {
  it("switches to H:MM:SS exactly at one hour", () => {
    expect(formatElapsed(3_600_000)).toBe("1:00:00");
    expect(formatElapsed(3_599_999)).toBe("59:59");
  });

  it("renders the documented 1:05:32", () => {
    expect(formatElapsed(3_932_000)).toBe("1:05:32");
  });

  it("does not pad the hour", () => {
    expect(formatElapsed(12 * 3_600_000 + 4 * 60_000 + 31_000)).toBe("12:04:31");
  });

  it("keeps counting past a day", () => {
    expect(formatElapsed(25 * 3_600_000)).toBe("25:00:00");
  });
});

describe("formatElapsed invalid input", () => {
  it("falls back rather than rendering NaN", () => {
    expect(formatElapsed(null)).toBe(TIMER_UNAVAILABLE);
    expect(formatElapsed(Number.NaN)).toBe(TIMER_UNAVAILABLE);
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe(TIMER_UNAVAILABLE);
  });

  it("clamps a negative duration to zero", () => {
    expect(formatElapsed(-5_000)).toBe("00:00");
  });

  it("truncates partial seconds down, never up", () => {
    expect(formatElapsed(1_999)).toBe("00:01");
  });
});

describe("elapsedMs", () => {
  it("is the gap between now and started_at", () => {
    expect(elapsedMs(iso(BASE), BASE + 8_420)).toBe(8_420);
  });

  it("is null when started_at is missing", () => {
    expect(elapsedMs(null, BASE)).toBeNull();
    expect(elapsedMs(undefined, BASE)).toBeNull();
    expect(elapsedMs("", BASE)).toBeNull();
  });

  it("is null when started_at is unparseable", () => {
    expect(elapsedMs("not a date", BASE)).toBeNull();
  });

  it("clamps a start that is in the future", () => {
    // A browser clock behind the server's would otherwise show a negative timer.
    expect(elapsedMs(iso(BASE + 10_000), BASE)).toBe(0);
  });

  it("is derived from the persisted timestamp, so a reload cannot change it", () => {
    const startedAt = iso(BASE);
    const first = elapsedMs(startedAt, BASE + 60_000);
    const afterReload = elapsedMs(startedAt, BASE + 61_000);
    expect(afterReload).toBeGreaterThan(first!);
  });
});

describe("durationMs for a completed match", () => {
  it("is completed_at minus started_at", () => {
    expect(durationMs(iso(BASE), iso(BASE + 8_420))).toBe(8_420);
    expect(durationMs(iso(BASE), iso(BASE + 3_932_000))).toBe(3_932_000);
  });

  it("is zero for a match started and finished in the same instant", () => {
    expect(durationMs(iso(BASE), iso(BASE))).toBe(0);
  });

  it("is null when either end is missing", () => {
    expect(durationMs(iso(BASE), null)).toBeNull();
    expect(durationMs(null, iso(BASE + 1_000))).toBeNull();
    expect(durationMs(null, null)).toBeNull();
  });

  it("clamps a completed_at that precedes started_at", () => {
    expect(durationMs(iso(BASE + 5_000), iso(BASE))).toBe(0);
  });
});

describe("timerValue", () => {
  it("counts up from started_at while playing", () => {
    expect(
      timerValue({ startedAt: iso(BASE), status: "playing", now: BASE + 8_420 }),
    ).toBe(8_420);
  });

  it("freezes at completed_at - started_at once completed", () => {
    const params = {
      startedAt: iso(BASE),
      completedAt: iso(BASE + 8_420),
      status: "completed" as const,
    };
    // Any `now`, before or after completion, reads the same frozen duration.
    expect(timerValue({ ...params, now: BASE })).toBe(8_420);
    expect(timerValue({ ...params, now: BASE + 999_999 })).toBe(8_420);
  });

  it("has nothing to show before the match starts", () => {
    expect(
      timerValue({ startedAt: iso(BASE), status: "staged", now: BASE + 8_420 }),
    ).toBeNull();
  });

  it("has nothing to show for a cancelled match", () => {
    expect(
      timerValue({ startedAt: iso(BASE), status: "cancelled", now: BASE + 8_420 }),
    ).toBeNull();
  });
});

describe("timerText", () => {
  it("shows a running clock while playing", () => {
    expect(
      timerText({ startedAt: iso(BASE), status: "playing", now: BASE + 524_000 }),
    ).toBe("08:44");
  });

  it("shows the final duration once completed", () => {
    expect(
      timerText({
        startedAt: iso(BASE),
        completedAt: iso(BASE + 8_420),
        status: "completed",
        now: BASE + 10_000_000,
      }),
    ).toBe("00:08");
  });

  it("shows the final duration with an hour form when the game ran long", () => {
    expect(
      timerText({
        startedAt: iso(BASE),
        completedAt: iso(BASE + 3_932_000),
        status: "completed",
        now: BASE + 5_000_000,
      }),
    ).toBe("1:05:32");
  });

  it("says Cancelled for a cancelled match instead of a frozen clock", () => {
    expect(
      timerText({
        startedAt: iso(BASE),
        completedAt: iso(BASE + 60_000),
        status: "cancelled",
        now: BASE + 120_000,
      }),
    ).toBe("Cancelled");
  });

  it("shows nothing for a staged match", () => {
    expect(
      timerText({ startedAt: iso(BASE), status: "staged", now: BASE }),
    ).toBeNull();
  });

  it("falls back when a playing match has no started_at", () => {
    expect(
      timerText({ startedAt: null, status: "playing", now: BASE }),
    ).toBe(TIMER_UNAVAILABLE);
  });

  it("falls back when a completed match has no started_at", () => {
    expect(
      timerText({
        startedAt: null,
        completedAt: iso(BASE),
        status: "completed",
        now: BASE,
      }),
    ).toBe(TIMER_UNAVAILABLE);
  });
});

describe("hasUntimedPlayingMatch", () => {
  it("flags a playing match with no start", () => {
    expect(hasUntimedPlayingMatch({ startedAt: null, status: "playing" })).toBe(
      true,
    );
    expect(
      hasUntimedPlayingMatch({ startedAt: "not a date", status: "playing" }),
    ).toBe(true);
  });

  it("does not flag a healthy playing match", () => {
    expect(
      hasUntimedPlayingMatch({ startedAt: iso(BASE), status: "playing" }),
    ).toBe(false);
  });

  it("does not flag other statuses", () => {
    expect(hasUntimedPlayingMatch({ startedAt: null, status: "staged" })).toBe(
      false,
    );
    expect(hasUntimedPlayingMatch({ startedAt: null, status: "completed" })).toBe(
      false,
    );
    expect(hasUntimedPlayingMatch({ startedAt: null, status: "cancelled" })).toBe(
      false,
    );
  });
});