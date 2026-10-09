import { describe, expect, it } from "vitest";
import {
  attendanceLabel,
  estimatedWaitMinutes,
  formatEstimatedWait,
  formatWaitingTime,
  waitingDurationMs,
} from "./wait-time";

describe("queue wait estimates", () => {
  it("spreads queued players across active courts", () => {
    expect(estimatedWaitMinutes({ queuePosition: 1, courtCount: 2, averageMatchMinutes: 12 })).toBe(12);
    expect(estimatedWaitMinutes({ queuePosition: 2, courtCount: 2, averageMatchMinutes: 12 })).toBe(12);
    expect(estimatedWaitMinutes({ queuePosition: 3, courtCount: 2, averageMatchMinutes: 12 })).toBe(24);
  });

  it("uses a documented fallback before the first completed game", () => {
    expect(estimatedWaitMinutes({ queuePosition: 1, courtCount: 1, averageMatchMinutes: null })).toBe(15);
  });

  it("returns no estimate for somebody outside the queue", () => {
    expect(estimatedWaitMinutes({ queuePosition: null, courtCount: 2, averageMatchMinutes: 10 })).toBeNull();
    expect(formatEstimatedWait(null)).toBe("—");
  });
});

describe("waiting clock", () => {
  it("prefers the most recent enqueue time", () => {
    expect(
      waitingDurationMs(
        "2026-01-01T10:05:00.000Z",
        "2026-01-01T10:00:00.000Z",
        Date.parse("2026-01-01T10:13:20.000Z"),
      ),
    ).toBe(500_000);
    expect(formatWaitingTime(500_000)).toBe("08:20");
  });

  it("clamps a future timestamp instead of showing negative time", () => {
    expect(waitingDurationMs("2026-01-01T11:00:00Z", null, Date.parse("2026-01-01T10:00:00Z"))).toBe(0);
  });
});

describe("public attendance labels", () => {
  it.each([
    ["waiting", "Waiting"],
    ["staged", "Up Next"],
    ["playing", "Playing"],
    ["break", "On Break"],
    ["checked_out", "Checked Out"],
    ["finished", "Finished"],
  ] as const)("maps %s to %s", (status, label) => {
    expect(attendanceLabel(status)).toBe(label);
  });
});
