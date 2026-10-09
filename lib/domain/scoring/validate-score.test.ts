import { describe, expect, it } from "vitest";
import {
  describeScoreResult,
  validateScore,
  type ScoreInput,
} from "./validate-score";

function score(overrides: Partial<ScoreInput>): ScoreInput {
  return {
    team1Score: 11,
    team2Score: 9,
    targetScore: 11,
    winBy: 1,
    ...overrides,
  };
}

describe("validateScore", () => {
  it("accepts a normal win at the target", () => {
    const result = validateScore(score({}));

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.winningTeam).toBe(1);
    expect(result.pointDiff).toBe(2);
  });

  it("identifies team 2 as the winner without the client naming them", () => {
    const result = validateScore(score({ team1Score: 4, team2Score: 11 }));

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.winningTeam).toBe(2);
    expect(result.pointDiff).toBe(7);
  });

  it("rejects a tie", () => {
    const result = validateScore(score({ team1Score: 11, team2Score: 11 }));

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/tie/i);
  });

  it("rejects a tie at zero", () => {
    const result = validateScore(score({ team1Score: 0, team2Score: 0 }));

    expect(result.valid).toBe(false);
  });

  it("rejects a score below the target", () => {
    const result = validateScore(score({ team1Score: 10, team2Score: 8 }));

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/must reach 11/);
  });

  it("accepts a deuce win that goes past the target", () => {
    const result = validateScore(score({ team1Score: 14, team2Score: 12 }));

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.winningTeam).toBe(1);
  });

  it("rejects an odd margin when win by 2", () => {
    const result = validateScore(
      score({ team1Score: 11, team2Score: 10, winBy: 2 }),
    );

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/win by 2/i);
  });

  it("accepts an even margin when win by 2", () => {
    const result = validateScore(
      score({ team1Score: 12, team2Score: 10, winBy: 2 }),
    );

    expect(result.valid).toBe(true);
  });

  it("honours a 15 point target", () => {
    const reaching = validateScore(
      score({ team1Score: 15, team2Score: 13, targetScore: 15 }),
    );
    const short = validateScore(
      score({ team1Score: 14, team2Score: 12, targetScore: 15 }),
    );

    expect(reaching.valid).toBe(true);
    expect(short.valid).toBe(false);
  });

  it("honours a 21 point target", () => {
    const reaching = validateScore(
      score({ team1Score: 21, team2Score: 19, targetScore: 21 }),
    );
    const short = validateScore(
      score({ team1Score: 15, team2Score: 13, targetScore: 21 }),
    );

    expect(reaching.valid).toBe(true);
    expect(short.valid).toBe(false);
  });

  it("rejects negative scores", () => {
    const result = validateScore(score({ team1Score: -1, team2Score: 11 }));

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/negative/i);
  });

  it("rejects non-integer scores", () => {
    expect(validateScore(score({ team1Score: 11.5, team2Score: 9 })).valid).toBe(
      false,
    );
    expect(validateScore(score({ team1Score: 11, team2Score: Number.NaN })).valid).toBe(
      false,
    );
  });

  it("rejects an unknown target score", () => {
    const result = validateScore(score({ targetScore: 7 as ScoreInput["targetScore"] }));

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/11, 15, or 21/);
  });

  it("rejects an unknown win by value", () => {
    const result = validateScore(score({ winBy: 3 as ScoreInput["winBy"] }));

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.error).toMatch(/1 or 2/);
  });

  it("rejects an absurdly high score", () => {
    expect(validateScore(score({ team1Score: 500, team2Score: 3 })).valid).toBe(true);
  });
});

describe("describeScoreResult", () => {
  it("describes a win", () => {
    expect(describeScoreResult(score({}))).toBe("Team 1 wins 11–9.");
  });

  it("describes a team 2 win", () => {
    expect(describeScoreResult(score({ team1Score: 5, team2Score: 15 }))).toBe(
      "Team 2 wins 15–5.",
    );
  });

  it("surfaces the error for an invalid score", () => {
    expect(describeScoreResult(score({ team1Score: 9, team2Score: 9 }))).toMatch(
      /tie/i,
    );
  });
});
