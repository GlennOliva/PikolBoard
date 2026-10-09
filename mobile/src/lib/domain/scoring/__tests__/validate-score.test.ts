import { validateScore } from "@/lib/domain/scoring/validate-score";

describe("validateScore", () => {
  it("accepts a game that reaches the target with the required margin", () => {
    expect(validateScore({ team1Score: 11, team2Score: 9, targetScore: 11, winBy: 1 })).toEqual({
      valid: true,
      winningTeam: 1,
      pointDiff: 2,
    });
  });

  it("names the higher-scoring team as the winner regardless of side", () => {
    const result = validateScore({ team1Score: 5, team2Score: 11, targetScore: 11, winBy: 1 });
    expect(result.valid && result.winningTeam).toBe(2);
  });

  it("rejects a tie", () => {
    const result = validateScore({ team1Score: 11, team2Score: 11, targetScore: 11, winBy: 1 });
    expect(result.valid).toBe(false);
  });

  it("rejects a score below the target", () => {
    const result = validateScore({ team1Score: 10, team2Score: 5, targetScore: 11, winBy: 1 });
    expect(result.valid).toBe(false);
  });

  it("enforces win-by-2", () => {
    const result = validateScore({ team1Score: 15, team2Score: 14, targetScore: 15, winBy: 2 });
    expect(result.valid).toBe(false);
    expect(validateScore({ team1Score: 16, team2Score: 14, targetScore: 15, winBy: 2 }).valid).toBe(
      true,
    );
  });

  it("rejects negative and non-integer scores", () => {
    expect(
      validateScore({ team1Score: -1, team2Score: 11, targetScore: 11, winBy: 1 }).valid,
    ).toBe(false);
    expect(
      validateScore({ team1Score: 11.5, team2Score: 9, targetScore: 11, winBy: 1 }).valid,
    ).toBe(false);
  });
});
