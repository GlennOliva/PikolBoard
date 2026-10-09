import { proposeMatch } from "@/lib/domain/matching";
import type { QueueCandidate } from "@/lib/domain/matching";

function candidate(overrides: Partial<QueueCandidate> & { id: string }): QueueCandidate {
  return {
    displayName: overrides.id,
    skillLevel: 3,
    attendanceStatus: "waiting",
    queuePosition: 1,
    gamesPlayed: 0,
    timesSkipped: 0,
    lastPlayedAt: null,
    lastEnqueuedAt: null,
    ...overrides,
  };
}

const rules = {
  format: "doubles" as const,
  mode: "fifo" as const,
  maxGames: null,
  starvationThresholdMinutes: 20,
  now: new Date("2026-01-01T00:00:00Z"),
};

describe("proposeMatch (fifo)", () => {
  it("refuses when there are not enough waiting players", () => {
    const result = proposeMatch([candidate({ id: "a" })], rules);
    expect(result.ok).toBe(false);
  });

  it("proposes the four earliest queued players", () => {
    const candidates = [
      candidate({ id: "a", queuePosition: 1 }),
      candidate({ id: "b", queuePosition: 2 }),
      candidate({ id: "c", queuePosition: 3 }),
      candidate({ id: "d", queuePosition: 4 }),
      candidate({ id: "e", queuePosition: 5 }),
    ];
    const result = proposeMatch(candidates, rules);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.proposal.players.map((p) => p.playerId).sort();
    expect(ids).toEqual(["a", "b", "c", "d"]);
    expect(result.proposal.explanation.length).toBeGreaterThan(0);
  });

  it("skips players on break and players already playing", () => {
    const candidates = [
      candidate({ id: "a", queuePosition: 1 }),
      candidate({ id: "b", queuePosition: 2, attendanceStatus: "break" }),
      candidate({ id: "c", queuePosition: 3 }),
      candidate({ id: "d", queuePosition: 4, attendanceStatus: "playing" }),
      candidate({ id: "e", queuePosition: 5 }),
      candidate({ id: "f", queuePosition: 6 }),
    ];
    const result = proposeMatch(candidates, rules);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.proposal.players.map((p) => p.playerId).sort();
    expect(ids).toEqual(["a", "c", "e", "f"]);
  });
});
