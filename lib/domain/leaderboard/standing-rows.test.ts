import { describe, expect, it } from "vitest";
import {
  formatPointDifferential,
  formatRecord,
  pointDifferential,
  winPercent,
  winRatio,
  type StandingTotals,
} from "./standing-rows";

const ZERO: StandingTotals = {
  games_played: 0,
  wins: 0,
  losses: 0,
  points_for: 0,
  points_against: 0,
};

function totals(overrides: Partial<StandingTotals> = {}): StandingTotals {
  return { ...ZERO, ...overrides };
}

describe("zero-game players", () => {
  it("reports a zero win ratio rather than dividing by zero", () => {
    expect(winRatio(ZERO)).toBe(0);
  });

  it("renders a zero win percentage, not NaN", () => {
    expect(winPercent(ZERO)).toBe("0.0%");
  });

  it("renders a bare zero differential", () => {
    expect(formatPointDifferential(pointDifferential(ZERO))).toBe("0");
  });

  it("renders a zero record", () => {
    expect(formatRecord(0, 0)).toBe("0–0");
  });
});

describe("played players", () => {
  it("keeps the ratio exact for ranking", () => {
    expect(winRatio(totals({ games_played: 3, wins: 2 }))).toBeCloseTo(2 / 3, 10);
  });

  it("rounds the displayed percentage to one decimal", () => {
    expect(winPercent(totals({ games_played: 3, wins: 2 }))).toBe("66.7%");
    expect(winPercent(totals({ games_played: 3, wins: 1 }))).toBe("33.3%");
    expect(winPercent(totals({ games_played: 2, wins: 1 }))).toBe("50.0%");
  });

  it("shows a perfect record at 100%", () => {
    expect(winPercent(totals({ games_played: 4, wins: 4 }))).toBe("100.0%");
  });
});

describe("point differential", () => {
  it("subtracts points against from points for", () => {
    expect(pointDifferential(totals({ points_for: 44, points_against: 39 }))).toBe(5);
  });

  it("signs a positive differential", () => {
    expect(formatPointDifferential(7)).toBe("+7");
  });

  it("keeps the minus sign on a negative differential", () => {
    expect(formatPointDifferential(-3)).toBe("-3");
  });

  it("can go negative when a player is outscored", () => {
    expect(
      formatPointDifferential(pointDifferential(totals({ points_for: 9, points_against: 22 }))),
    ).toBe("-13");
  });
});