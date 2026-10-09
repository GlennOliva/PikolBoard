import { describe, expect, it } from "vitest";
import { proposeFifo } from "./fifo";
import type { MatchingRules, QueueCandidate } from "./types";

const NOW = new Date("2026-01-15T12:00:00.000Z");

function rules(overrides: Partial<MatchingRules> = {}): MatchingRules {
  return {
    format: "doubles",
    mode: "fifo",
    maxGames: null,
    starvationThresholdMinutes: 15,
    now: NOW,
    ...overrides,
  };
}

/** Builder with sensible defaults: waiting, queued, never played. */
function player(
  id: string,
  overrides: Partial<QueueCandidate> = {},
): QueueCandidate {
  return {
    id,
    displayName: `Player ${id}`,
    skillLevel: 3,
    attendanceStatus: "waiting",
    queuePosition: null,
    gamesPlayed: 0,
    timesSkipped: 0,
    lastPlayedAt: null,
    lastEnqueuedAt: NOW,
    ...overrides,
  };
}

function queued(
  ids: string[],
  overrides: Partial<QueueCandidate> = {},
): QueueCandidate[] {
  return ids.map((id, index) =>
    player(id, { queuePosition: index + 1, ...overrides }),
  );
}

describe("proposeFifo", () => {
  it("takes the first four players in queue order for doubles", () => {
    const candidates = queued(["a", "b", "c", "d", "e", "f"]);

    const result = proposeFifo(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players.map((p) => p.playerId)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(result.proposal.skippedPlayerIds).toEqual(["e", "f"]);
  });

  it("takes the first two players for singles", () => {
    const candidates = queued(["a", "b", "c", "d"]);

    const result = proposeFifo(candidates, rules({ format: "singles" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players).toHaveLength(2);
    expect(result.proposal.players.map((p) => p.playerId)).toEqual(["a", "b"]);
  });

  it("reports when there are not enough players", () => {
    const result = proposeFifo(queued(["a", "b", "c"]), rules());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_enough_players");
    expect(result.message).toContain("3 players waiting");
    expect(result.message).toContain("need 4");
  });

  it("ignores players who are not waiting", () => {
    const candidates = [
      player("a", { queuePosition: 1 }),
      player("b", { queuePosition: 2 }),
      player("c", { queuePosition: 3, attendanceStatus: "playing" }),
      player("d", { queuePosition: 4, attendanceStatus: "break" }),
      player("e", { queuePosition: 5, attendanceStatus: "staged" }),
      player("f", { queuePosition: 6, attendanceStatus: "checked_out" }),
      player("g", { queuePosition: 7 }),
      player("h", { queuePosition: 8 }),
    ];

    const result = proposeFifo(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // c, d, e, f are ineligible, so the match is a + b + g + h.
    expect(result.proposal.players.map((p) => p.playerId)).toEqual([
      "a",
      "b",
      "g",
      "h",
    ]);
  });

  it("balances team skill for the first four players", () => {
    // Skills 1, 2, 5, 6 -> the even split is (1+6) vs (2+5).
    const candidates = queued(["a", "b", "c", "d"], {
      skillLevel: 0,
    }).map((p, i) => ({
      ...p,
      skillLevel: [1, 2, 5, 6][i],
    }));

    const result = proposeFifo(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const team1 = result.proposal.players.filter((p) => p.teamNumber === 1);
    const team2 = result.proposal.players.filter((p) => p.teamNumber === 2);
    const skill = (team: typeof team1) =>
      team.reduce((sum, p) => sum + p.skillLevel, 0);
    expect(Math.abs(skill(team1) - skill(team2))).toBe(0);
  });

  it("always returns a human readable explanation", () => {
    const result = proposeFifo(queued(["a", "b", "c", "d"]), rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.explanation.length).toBeGreaterThan(10);
    expect(result.proposal.explanation).toMatch(/first-out|longest-waiting/i);
  });

  it("is deterministic for identical input", () => {
    const candidates = queued(["a", "b", "c", "d", "e"]);
    const first = proposeFifo(candidates, rules());
    const second = proposeFifo(candidates, rules());

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});