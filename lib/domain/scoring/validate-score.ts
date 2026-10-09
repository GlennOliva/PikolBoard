export type TargetScore = 11 | 15 | 21;
export type WinBy = 1 | 2;

export interface ScoreInput {
  team1Score: number;
  team2Score: number;
  targetScore: TargetScore;
  winBy: WinBy;
}

export type ScoreValidation =
  | { valid: true; winningTeam: 1 | 2; pointDiff: number }
  | { valid: false; error: string };

export const TARGET_SCORES: TargetScore[] = [11, 15, 21];
export const WIN_BY_OPTIONS: WinBy[] = [1, 2];

/**
 * Server-side scoring rule. The client never names a winner: it sends two
 * non-negative integers and this decides who won.
 *
 * A completed score is valid only when the winning score reaches the target
 * and the margin satisfies win-by. Ties are rejected.
 */
export function validateScore(input: ScoreInput): ScoreValidation {
  const { team1Score, team2Score, targetScore, winBy } = input;

  if (!Number.isInteger(team1Score) || !Number.isInteger(team2Score)) {
    return { valid: false, error: "Scores must be whole numbers." };
  }

  if (team1Score < 0 || team2Score < 0) {
    return { valid: false, error: "Scores cannot be negative." };
  }

  if (!TARGET_SCORES.includes(targetScore)) {
    return { valid: false, error: "Target score must be 11, 15, or 21." };
  }

  if (!WIN_BY_OPTIONS.includes(winBy)) {
    return { valid: false, error: "Win by must be 1 or 2." };
  }

  if (team1Score === team2Score) {
    return { valid: false, error: "A finished game cannot end in a tie." };
  }

  const pointDiff = Math.abs(team1Score - team2Score);
  const highScore = Math.max(team1Score, team2Score);

  if (highScore < targetScore) {
    return {
      valid: false,
      error: `The winning score must reach ${targetScore}.`,
    };
  }

  if (pointDiff < winBy) {
    return {
      valid: false,
      error:
        winBy === 1
          ? "The winning team must win by at least 1 point."
          : "The winning team must win by 2 points.",
    };
  }

  return {
    valid: true,
    winningTeam: team1Score > team2Score ? 1 : 2,
    pointDiff,
  };
}

/** Convenience wrapper for the score correction dialog. */
export function describeScoreResult(input: ScoreInput): string {
  const result = validateScore(input);
  if (!result.valid) return result.error;
  return `Team ${result.winningTeam} wins ${Math.max(
    input.team1Score,
    input.team2Score,
  )}–${Math.min(input.team1Score, input.team2Score)}.`;
}