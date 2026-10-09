import { describe, expect, it } from "vitest";
import {
  DEFAULT_MATCH_MINUTES,
  estimateWait,
  formatElapsed,
  rollingAverageMatchMinutes,
  sessionElapsedMinutes,
} from "./estimate-wait";

describe("estimateWait", () => {
  it("returns zero for the next player up", () => {
    const result = estimateWait({
      playersAhead: 0,
      format: "doubles",
      availableCourts: 1,
    });

    expect(result.minutes).toBe(0);
  });

  it("uses the default duration when no matches have finished", () => {
    const result = estimateWait({
      playersAhead: 4,
      format: "doubles",
      availableCourts: 1,
    });

    // 4 ahead / 4 per match / 1 court = 1 wave.
    expect(result.minutes).toBe(DEFAULT_MATCH_MINUTES);
    expect(result.isDefaultDuration).toBe(true);
    expect(result.assumedMatchMinutes).toBe(DEFAULT_MATCH_MINUTES);
  });

  it("rounds up to whole waves", () => {
    const result = estimateWait({
      playersAhead: 5,
      format: "doubles",
      availableCourts: 1,
    });

    // 5 ahead -> ceil(5/4) = 2 waves.
    expect(result.minutes).toBe(DEFAULT_MATCH_MINUTES * 2);
  });

  it("divides across available courts", () => {
    const result = estimateWait({
      playersAhead: 8,
      format: "doubles",
      availableCourts: 2,
    });

    // 8 / 4 / 2 = 1 wave.
    expect(result.minutes).toBe(DEFAULT_MATCH_MINUTES);
  });

  it("still reports a wave when no court is free", () => {
    const result = estimateWait({
      playersAhead: 4,
      format: "doubles",
      availableCourts: 0,
    });

    // Treated as a single court rather than dividing by zero.
    expect(result.minutes).toBe(DEFAULT_MATCH_MINUTES);
  });

  it("uses the rolling average once data exists", () => {
    const result = estimateWait({
      playersAhead: 4,
      format: "doubles",
      availableCourts: 1,
      rollingAverageMatchMinutes: 20,
    });

    expect(result.minutes).toBe(20);
    expect(result.isDefaultDuration).toBe(false);
  });

  it("falls back to the default for a nonsense average", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = estimateWait({
        playersAhead: 4,
        format: "doubles",
        availableCourts: 1,
        rollingAverageMatchMinutes: bad,
      });
      expect(result.isDefaultDuration).toBe(true);
      expect(result.minutes).toBe(DEFAULT_MATCH_MINUTES);
    }
  });

  it("treats a null average as no data", () => {
    const result = estimateWait({
      playersAhead: 4,
      format: "doubles",
      availableCourts: 1,
      rollingAverageMatchMinutes: null,
    });

    expect(result.isDefaultDuration).toBe(true);
  });

  it("handles singles", () => {
    const result = estimateWait({
      playersAhead: 3,
      format: "singles",
      availableCourts: 1,
    });

    // 3 ahead / 2 per match = 2 waves.
    expect(result.minutes).toBe(DEFAULT_MATCH_MINUTES * 2);
  });

  it("clamps a negative playersAhead", () => {
    const result = estimateWait({
      playersAhead: -10,
      format: "doubles",
      availableCourts: 1,
    });

    expect(result.minutes).toBe(0);
  });
});

describe("rollingAverageMatchMinutes", () => {
  it("averages completed durations", () => {
    const ten = 10 * 60_000;
    const twenty = 20 * 60_000;
    expect(rollingAverageMatchMinutes([ten, twenty])).toBe(15);
  });

  it("returns null with no samples", () => {
    expect(rollingAverageMatchMinutes([])).toBeNull();
  });

  it("ignores zero and non-finite samples", () => {
    const result = rollingAverageMatchMinutes([10 * 60_000, 0, -1, Number.NaN]);
    expect(result).toBe(10);
  });

  it("can require a minimum sample count", () => {
    expect(rollingAverageMatchMinutes([10 * 60_000], 3)).toBeNull();
    expect(
      rollingAverageMatchMinutes([10 * 60_000, 20 * 60_000, 30 * 60_000], 3),
    ).toBe(20);
  });
});

describe("sessionElapsedMinutes", () => {
  const now = new Date("2026-01-15T12:30:00.000Z");

  it("counts whole minutes since the session started", () => {
    expect(
      sessionElapsedMinutes("2026-01-15T11:00:00.000Z", now),
    ).toBe(90);
  });

  it("floors partial minutes", () => {
    expect(
      sessionElapsedMinutes("2026-01-15T12:00:00.000Z", now),
    ).toBe(30);
  });

  it("returns zero before the start time", () => {
    expect(
      sessionElapsedMinutes("2026-01-15T13:00:00.000Z", now),
    ).toBe(0);
  });

  it("returns zero for a missing or invalid start", () => {
    expect(sessionElapsedMinutes(null, now)).toBe(0);
    expect(sessionElapsedMinutes("not-a-date", now)).toBe(0);
  });

  it("accepts a Date", () => {
    expect(sessionElapsedMinutes(new Date("2026-01-15T12:00:00.000Z"), now)).toBe(30);
  });
});

describe("formatElapsed", () => {
  it("formats minutes under an hour", () => {
    expect(formatElapsed(0)).toBe("0m");
    expect(formatElapsed(45)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatElapsed(60)).toBe("1h 00m");
    expect(formatElapsed(64)).toBe("1h 04m");
    expect(formatElapsed(135)).toBe("2h 15m");
  });

  it("clamps negatives to zero", () => {
    expect(formatElapsed(-5)).toBe("0m");
  });
});
