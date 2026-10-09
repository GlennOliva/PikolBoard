import { estimateWait, DEFAULT_MATCH_MINUTES } from "@/lib/domain/queue/estimate-wait";

describe("estimateWait", () => {
  it("assumes the default duration with no history", () => {
    const result = estimateWait({ playersAhead: 0, format: "doubles", availableCourts: 2 });
    expect(result.isDefaultDuration).toBe(true);
    expect(result.assumedMatchMinutes).toBe(DEFAULT_MATCH_MINUTES);
    expect(result.minutes).toBe(0);
  });

  it("divides the queue across matches and courts", () => {
    const result = estimateWait({
      playersAhead: 8,
      format: "doubles",
      availableCourts: 2,
      rollingAverageMatchMinutes: 12,
    });
    // 8 players / 4 per match / 2 courts = 1 wave * 12 minutes.
    expect(result.minutes).toBe(12);
  });

  it("uses the measured average when available", () => {
    const result = estimateWait({
      playersAhead: 4,
      format: "singles",
      availableCourts: 1,
      rollingAverageMatchMinutes: 20,
    });
    expect(result.minutes).toBe(40);
    expect(result.isDefaultDuration).toBe(false);
  });
});
