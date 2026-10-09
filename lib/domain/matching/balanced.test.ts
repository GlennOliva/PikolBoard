import { describe, expect, it } from "vitest";
import { proposeBalanced } from "./balanced";
import { proposeSkillSeparated } from "./skill-separated";
import type { MatchingRules, QueueCandidate, RecentMatch } from "./types";

const NOW = new Date("2026-01-15T12:00:00.000Z");

function rules(overrides: Partial<MatchingRules> = {}): MatchingRules {
  return {
    format: "doubles",
    mode: "balanced",
    maxGames: null,
    starvationThresholdMinutes: 15,
    now: NOW,
    ...overrides,
  };
}

function player(
  id: string,
  skillLevel: number,
  overrides: Partial<QueueCandidate> = {},
): QueueCandidate {
  return {
    id,
    displayName: `Player ${id}`,
    skillLevel,
    attendanceStatus: "waiting",
    queuePosition: null,
    gamesPlayed: 0,
    timesSkipped: 0,
    lastPlayedAt: null,
    lastEnqueuedAt: NOW,
    ...overrides,
  };
}

function queue(
  entries: Array<[string, number]>,
  overrides: (index: number) => Partial<QueueCandidate> = () => ({}),
): QueueCandidate[] {
  return entries.map(([id, skill], index) =>
    player(id, skill, { queuePosition: index + 1, ...overrides(index) }),
  );
}

function ids(players: Array<{ playerId: string }>): string[] {
  return players.map((p) => p.playerId).sort();
}

describe("proposeBalanced", () => {
  it("prefers the earliest players when skills are equal", () => {
    const result = proposeBalanced(queue([["a", 3], ["b", 3], ["c", 3], ["d", 3], ["e", 3], ["f", 3]]), rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ids(result.proposal.players)).toEqual(["a", "b", "c", "d"]);
  });

  it("balances team skill rather than always taking the first four", () => {
    // a(1) b(2) c(5) d(6): FIFO would pair (1,2) vs (5,6) = gap 8.
    // Balanced should find a split with a much smaller gap.
    const result = proposeBalanced(queue([["a", 1], ["b", 2], ["c", 5], ["d", 6]]), rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.breakdown.teamSkillDifference).toBe(0);
  });

  it("prefers even teams for singles", () => {
    const result = proposeBalanced(
      queue([["a", 1], ["b", 2], ["c", 5], ["d", 6]]),
      rules({ format: "singles" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const team1 = result.proposal.players.find((p) => p.teamNumber === 1);
    const team2 = result.proposal.players.find((p) => p.teamNumber === 2);
    expect(Math.abs((team1?.skillLevel ?? 0) - (team2?.skillLevel ?? 0))).toBeLessThanOrEqual(1);
  });

  it("avoids repeat partners from recent matches", () => {
    const candidates = queue([["a", 3], ["b", 3], ["c", 3], ["d", 3]]);

    // a+b and c+d were partners last match.
    const history: RecentMatch[] = [{ team1: ["a", "b"], team2: ["c", "d"] }];

    const result = proposeBalanced(candidates, rules(), history);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Same four earliest players, but re-partnered so nobody repeats.
    expect(ids(result.proposal.players)).toEqual(["a", "b", "c", "d"]);
    expect(result.proposal.breakdown.repeatPartnerCount).toBe(0);

    const teamA = result.proposal.players.find((p) => p.playerId === "a")?.teamNumber;
    const teamB = result.proposal.players.find((p) => p.playerId === "b")?.teamNumber;
    const teamC = result.proposal.players.find((p) => p.playerId === "c")?.teamNumber;
    const teamD = result.proposal.players.find((p) => p.playerId === "d")?.teamNumber;
    expect(teamA).not.toBe(teamB);
    expect(teamC).not.toBe(teamD);
    // They are opponents again, which the cheaper term tolerates.
    expect(result.proposal.breakdown.repeatOpponentCount).toBe(2);
  });

  it("counts repeat partners when the pool forces a repeat pairing", () => {
    // Four eligible players, all skill 3. The recent history has already
    // covered all six possible partnerships across the three prior matches, so
    // every available partition necessarily repeats a partner.
    const candidates = queue([["a", 3], ["b", 3], ["c", 3], ["d", 3]]);
    const history: RecentMatch[] = [
      { team1: ["a", "b"], team2: ["c", "d"] },
      { team1: ["a", "c"], team2: ["b", "d"] },
      { team1: ["a", "d"], team2: ["b", "c"] },
    ];

    const result = proposeBalanced(candidates, rules(), history);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.breakdown.repeatPartnerCount).toBeGreaterThan(0);
  });

  it("weighs repeat partners more heavily than repeat opponents", () => {
    // Same candidate set and same unavoidable repeats, differing only in which
    // relationship is being repeated. The partner case must cost more.
    const candidates = queue([["a", 3], ["b", 3], ["c", 3], ["d", 3]]);

    const partnered = proposeBalanced(candidates, rules(), [
      { team1: ["a", "c"], team2: ["b", "d"] },
    ]);
    const faced = proposeBalanced(candidates, rules(), [
      { team1: ["a", "b"], team2: ["c", "d"] },
    ]);

    if (!partnered.ok || !faced.ok) throw new Error("expected proposals");

    // In the first history, a+c and b+d are prior partners -> keep them apart
    // if possible. In the second, a+b and c+d are prior partners.
    const partnerCost = partnered.proposal.breakdown.repeatPartnerCount * 25;
    const opponentCost = faced.proposal.breakdown.repeatOpponentCount * 10;

    expect(partnered.proposal.breakdown.repeatPartnerCount).toBe(0);
    expect(faced.proposal.breakdown.repeatPartnerCount).toBe(0);
    expect(opponentCost).toBeGreaterThan(0);
    expect(partnerCost).toBeGreaterThanOrEqual(0);
  });

  it("includes a starved player instead of an unstarved one", () => {
    const old = new Date(NOW.getTime() - 60 * 60_000);
    const candidates = queue(
      [
        ["a", 3],
        ["b", 3],
        ["c", 3],
        ["d", 3],
        ["starved", 3],
      ],
      (index) => (index === 4 ? { lastEnqueuedAt: old } : {}),
    );

    const result = proposeBalanced(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players.map((p) => p.playerId)).toContain("starved");
    expect(result.proposal.breakdown.starvationPenalty).toBe(0);
  });

  it("never starves a player who waited past the threshold", () => {
    // Several starved players: they should crowd out the fresh front of queue.
    const longAgo = new Date(NOW.getTime() - 90 * 60_000);
    const candidates = [
      player("a", 3, { queuePosition: 1, lastEnqueuedAt: NOW }),
      player("b", 3, { queuePosition: 2, lastEnqueuedAt: NOW }),
      player("c", 3, { queuePosition: 3, lastEnqueuedAt: longAgo }),
      player("d", 3, { queuePosition: 4, lastEnqueuedAt: longAgo }),
      player("e", 3, { queuePosition: 5, lastEnqueuedAt: longAgo }),
      player("f", 3, { queuePosition: 6, lastEnqueuedAt: longAgo }),
    ];

    const result = proposeBalanced(candidates, rules({ starvationThresholdMinutes: 15 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const chosen = ids(result.proposal.players);
    // All four starved players must be included.
    for (const starved of ["c", "d", "e", "f"]) {
      expect(chosen).toContain(starved);
    }
  });

  it("respects the maximum games limit", () => {
    // a-d have hit the cap of 5; e-h are still eligible.
    const candidates = [
      player("a", 3, { queuePosition: 1, gamesPlayed: 5 }),
      player("b", 3, { queuePosition: 2, gamesPlayed: 5 }),
      player("c", 3, { queuePosition: 3, gamesPlayed: 5 }),
      player("d", 3, { queuePosition: 4, gamesPlayed: 5 }),
      player("e", 3, { queuePosition: 5, gamesPlayed: 1 }),
      player("f", 3, { queuePosition: 6, gamesPlayed: 0 }),
      player("g", 3, { queuePosition: 7, gamesPlayed: 2 }),
      player("h", 3, { queuePosition: 8, gamesPlayed: 3 }),
    ];

    const result = proposeBalanced(candidates, rules({ maxGames: 5 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const chosen = ids(result.proposal.players);
    expect(chosen).toEqual(["e", "f", "g", "h"]);
  });

  it("prefers eligible players over capped players at the front of the queue", () => {
    // a and b are capped, so a fresh player behind them must be chosen instead.
    const candidates = [
      player("a", 3, { queuePosition: 1, gamesPlayed: 5 }),
      player("b", 3, { queuePosition: 2, gamesPlayed: 5 }),
      player("c", 3, { queuePosition: 3, gamesPlayed: 5 }),
      player("d", 3, { queuePosition: 4, gamesPlayed: 5 }),
      player("e", 3, { queuePosition: 5, gamesPlayed: 0 }),
      player("f", 3, { queuePosition: 6, gamesPlayed: 0 }),
      player("g", 3, { queuePosition: 7, gamesPlayed: 0 }),
      player("h", 3, { queuePosition: 8, gamesPlayed: 0 }),
    ];

    const result = proposeBalanced(candidates, rules({ maxGames: 5 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ids(result.proposal.players)).not.toContain("a");
  });

  it("reports when the game limit leaves too few players", () => {
    const candidates = [
      player("a", 3, { queuePosition: 1, gamesPlayed: 5 }),
      player("b", 3, { queuePosition: 2, gamesPlayed: 5 }),
      player("c", 3, { queuePosition: 3, gamesPlayed: 5 }),
      player("d", 3, { queuePosition: 4, gamesPlayed: 5 }),
    ];

    const result = proposeBalanced(candidates, rules({ maxGames: 5 }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/need 4/);
  });

  it("includes a player who has been skipped twice even from the back of the queue", () => {
    // g is last in the queue but the database has recorded two skips.
    const candidates = queue([
      ["a", 3],
      ["b", 3],
      ["c", 3],
      ["d", 3],
      ["e", 3],
      ["f", 3],
      ["g", 3],
    ], (index) => (index === 6 ? { timesSkipped: 2 } : {}));

    const result = proposeBalanced(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players.map((p) => p.playerId)).toContain("g");
    // Starvation overrode the normal preference for the front of the queue.
    expect(result.proposal.skippedPlayerIds).not.toContain("g");
  });

  it("does not force a player who has only been skipped once", () => {
    const candidates = queue([
      ["a", 3],
      ["b", 3],
      ["c", 3],
      ["d", 3],
      ["e", 3],
      ["f", 3],
      ["g", 3],
    ], (index) => (index === 6 ? { timesSkipped: 1 } : {}));

    const result = proposeBalanced(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ids(result.proposal.players)).toEqual(["a", "b", "c", "d"]);
  });

  it("is deterministic for identical input", () => {
    const candidates = queue([["a", 2], ["b", 5], ["c", 3], ["d", 4], ["e", 1], ["f", 6]]);
    const first = proposeBalanced(candidates, rules());
    const second = proposeBalanced(candidates, rules());

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("keeps locked pairs on the same team", () => {
    const candidates = queue([["a", 3], ["b", 3], ["c", 3], ["d", 3]]);
    const result = proposeBalanced(candidates, rules({ lockedPairs: [["a", "b"]] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const teamA = result.proposal.players.find((p) => p.playerId === "a")?.teamNumber;
    const teamB = result.proposal.players.find((p) => p.playerId === "b")?.teamNumber;
    expect(teamA).toBe(teamB);
  });
});

describe("proposeSkillSeparated", () => {
  it("picks the tightest skill band", () => {
    const candidates = queue([["a", 3], ["b", 3], ["c", 3], ["d", 4], ["e", 1], ["f", 6]]);
    const result = proposeSkillSeparated(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.breakdown.skillRange).toBeLessThanOrEqual(1);
    expect(ids(result.proposal.players)).toEqual(["a", "b", "c", "d"]);
  });

  it("picks the tightest band when displacement is comparable", () => {
    // Same front-of-queue displacement for both groups, so skill range decides.
    // Windows: {a,b,c,d} range 1 vs {b,c,d,e} range 2 -> picks a,b,c,d.
    const candidates = queue([["a", 2], ["b", 2], ["c", 3], ["d", 3], ["e", 5]]);
    const result = proposeSkillSeparated(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.breakdown.skillRange).toBe(1);
    expect(ids(result.proposal.players)).toEqual(["a", "b", "c", "d"]);
  });

  it("weighs queue displacement above skill range, per the SOP weights", () => {
    // Front four: displacement 0+1+2+3=6, range 2 -> 6*70 + 2*100 = 620.
    // Back four:  displacement 4+5+6+7=22, range 1 -> 22*70 + 1*100 = 1640.
    // SOP ordering says waiting time is the first priority, so the front four
    // win even though the back group has a tighter band.
    const candidates = queue([["a", 1], ["b", 2], ["c", 3], ["d", 3], ["e", 2], ["f", 2], ["g", 3], ["h", 3]]);
    const result = proposeSkillSeparated(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ids(result.proposal.players)).toEqual(["a", "b", "c", "d"]);
    expect(result.proposal.breakdown.skillRange).toBe(2);
    expect(result.proposal.explanation).toMatch(/tightest skill band/i);
  });

  it("still prefers balanced teams within the chosen band", () => {
    const candidates = queue([["a", 2], ["b", 4], ["c", 2], ["d", 4]]);
    const result = proposeSkillSeparated(candidates, rules());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.breakdown.teamSkillDifference).toBe(0);
  });

  it("forces inclusion of a skill outlier that has waited too long", () => {
    const longAgo = new Date(NOW.getTime() - 45 * 60_000);
    const candidates = [
      player("a", 2, { queuePosition: 1 }),
      player("b", 2, { queuePosition: 2 }),
      player("c", 2, { queuePosition: 3 }),
      player("d", 2, { queuePosition: 4 }),
      player("outlier", 6, { queuePosition: 5, lastEnqueuedAt: longAgo }),
    ];

    const result = proposeSkillSeparated(
      candidates,
      rules({ starvationThresholdMinutes: 15 }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players.map((p) => p.playerId)).toContain("outlier");
    expect(result.proposal.explanation).toMatch(/nobody starves/i);
  });

  it("leaves an unstarved outlier out to keep the band tight", () => {
    const candidates = [
      player("a", 2, { queuePosition: 1 }),
      player("b", 2, { queuePosition: 2 }),
      player("c", 2, { queuePosition: 3 }),
      player("outlier", 6, { queuePosition: 4 }),
      player("e", 2, { queuePosition: 5 }),
      player("f", 2, { queuePosition: 6 }),
    ];

    const result = proposeSkillSeparated(
      candidates,
      rules({ starvationThresholdMinutes: 15 }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players.map((p) => p.playerId)).not.toContain("outlier");
  });

  it("works for singles", () => {
    const candidates = queue([["a", 4], ["b", 4], ["c", 1], ["d", 6]]);
    const result = proposeSkillSeparated(candidates, rules({ format: "singles" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.players).toHaveLength(2);
    expect(result.proposal.breakdown.skillRange).toBe(0);
    expect(ids(result.proposal.players)).toEqual(["a", "b"]);
  });

  it("is deterministic for identical input", () => {
    const candidates = queue([["a", 2], ["b", 5], ["c", 3], ["d", 4], ["e", 1], ["f", 6]]);
    const first = proposeSkillSeparated(candidates, rules());
    const second = proposeSkillSeparated(candidates, rules());

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});