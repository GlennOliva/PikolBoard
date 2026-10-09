import { formatDuration, initialsOf, formatTime } from "@/lib/format";

describe("format helpers", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatDuration(0.5)).toBe("30 s");
  });

  it("rounds minute durations", () => {
    expect(formatDuration(7.4)).toBe("7 min");
    expect(formatDuration(1)).toBe("1 min");
  });

  it("renders invalid durations as a dash", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });

  it("returns initials for up to two words", () => {
    expect(initialsOf("Alice Wong")).toBe("AW");
    expect(initialsOf("Prince")).toBe("P");
    expect(initialsOf("  ")).toBe("?");
  });

  it("formats a UTC timestamp consistently", () => {
    expect(formatTime("2026-01-01T13:05:00Z")).toMatch(/1:05/);
  });
});
