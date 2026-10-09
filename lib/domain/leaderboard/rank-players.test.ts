import { describe, expect, it } from "vitest";
import {
  computeWinPercentages,
  formatPercent,
  rankPlayers,
  type PlayerGameRow,
} from "./rank-players";

let clock = 0;
function at(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 0, 1, 0, clock)).toISOString();
}

function row(
  playerId: string,
  overrides: Partial<PlayerGameRow> = {},
): PlayerGameRow {
  return {
    playerId,
    displayName: `Player ${playerId}`,
    skillLevel: 3,
    won: false,
    pointsFor: 9,
    pointsAgainst: 11,
    opponentIds: [],
    opponentSkillTotal: 6,
    partnerIds: [],
    partnerSkillTotal: 0,
    completedAt: at(),
    ...overrides,
  };
}

describe("rankPlayers", () => {
  it("returns an empty list for no rows", () => {
    expect(rankPlayers([])).toEqual([]);
  });

  it("ranks by wins descending", () => {
    const rows = [
      row("a", { won: false }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("c", { won: true }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked[0].playerId).toBe("b");
    expect(ranked[0].wins).toBe(2);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].playerId).toBe("c");
    expect(ranked[2].playerId).toBe("a");
  });

  it("breaks a wins tie on exact win percentage", () => {
    // Both have 2 wins. a is 2/3, b is 2/4, so a ranks higher despite the
    // same win count.
    const rows = [
      row("a", { won: true }),
      row("a", { won: true }),
      row("a", { won: false }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("b", { won: false }),
      row("b", { won: false }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked[0].playerId).toBe("a");
    expect(ranked[0].winPercentage).toBeCloseTo(2 / 3, 10);
    expect(ranked[1].playerId).toBe("b");
    expect(ranked[1].winPercentage).toBeCloseTo(0.5, 10);
  });

  it("prioritises win count over win percentage", () => {
    // b has more wins (4) even though a has the better percentage.
    // a: 2/3 = 0.667, b: 4/6 = 0.667. Wins is the first sort key, so b leads.
    const rows = [
      row("a", { won: true }),
      row("a", { won: true }),
      row("a", { won: false }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("b", { won: false }),
      row("b", { won: false }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked[0].playerId).toBe("b");
    expect(ranked[0].wins).toBe(4);
    expect(ranked[1].playerId).toBe("a");
    expect(ranked[0].winPercentage).toBeCloseTo(ranked[1].winPercentage, 10);
    // Different win counts, so the ranks are not shared.
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it("orders near-equal percentages by the exact value", () => {
    // 3/4 = 0.75 beats 3/5 = 0.6. Rounding to whole percent would not change
    // this, but the comparison is still made on the exact ratio.
    const rows = [
      row("a", { won: true }),
      row("a", { won: true }),
      row("a", { won: true }),
      row("a", { won: false }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("b", { won: true }),
      row("b", { won: false }),
      row("b", { won: false }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked[0].playerId).toBe("a");
    expect(ranked[1].playerId).toBe("b");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it("falls back to strength of schedule", () => {
    // Both 1/1, identical points. a faced a strong opponent.
    const strong = [row("strong", { won: true })];
    const weak = [row("weak", { won: false })];

    const rows = [
      ...strong,
      ...weak,
      row("a", { won: true, opponentIds: ["strong"], opponentSkillTotal: 4 }),
      row("b", { won: true, opponentIds: ["weak"], opponentSkillTotal: 2 }),
    ];

    const ranked = rankPlayers(rows);

    const a = ranked.find((p) => p.playerId === "a");
    const b = ranked.find((p) => p.playerId === "b");
    expect(a?.strengthOfSchedule).toBeGreaterThan(b?.strengthOfSchedule ?? 1);
    expect(ranked[0].playerId).toBe("a");
  });

  it("counts an opponent with no completed games as zero", () => {
    const rows = [
      row("a", { won: true, opponentIds: ["ghost"] }),
      row("b", { won: true, opponentIds: ["a"] }),
    ];

    const ranked = rankPlayers(rows);
    const a = ranked.find((p) => p.playerId === "a");

    expect(a?.strengthOfSchedule).toBe(0);
  });

  it("falls back to point differential", () => {
    // Identical records (2-0, no opponents) and different point differentials.
    const rows = [
      row("a", { won: true, pointsFor: 11, pointsAgainst: 9 }),
      row("a", { won: true, pointsFor: 11, pointsAgainst: 9 }),
      row("b", { won: true, pointsFor: 15, pointsAgainst: 11 }),
      row("b", { won: true, pointsFor: 15, pointsAgainst: 11 }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked[0].playerId).toBe("b");
    expect(ranked[0].pointDifferential).toBe(8);
    expect(ranked[1].pointDifferential).toBe(4);
  });

  it("falls back to display name ascending", () => {
    const rows = [
      row("z", { displayName: "Zoe", won: true }),
      row("a", { displayName: "Ana", won: true }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked.map((p) => p.displayName)).toEqual(["Ana", "Zoe"]);
  });

  it("shares a rank between players identical on every tiebreaker", () => {
    const rows = [
      row("a", { displayName: "Ana", won: true }),
      row("b", { displayName: "Ben", won: true }),
      row("c", { displayName: "Cara", won: true }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 1]);
  });

  it("skips ranks after a shared rank", () => {
    const rows = [
      row("a", { displayName: "Ana", won: true, pointsFor: 20, pointsAgainst: 0 }),
      row("b", { displayName: "Ben", won: true, pointsFor: 20, pointsAgainst: 0 }),
      row("c", { displayName: "Cara", won: true, pointsFor: 11, pointsAgainst: 9 }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked.map((p) => [p.displayName, p.rank])).toEqual([
      ["Ana", 1],
      ["Ben", 1],
      ["Cara", 3],
    ]);
  });

  it("computes the current win and loss streak", () => {
    const rows = [
      row("a", { won: false }),
      row("a", { won: true }),
      row("a", { won: true }),
      row("a", { won: true }),
      row("b", { won: true }),
      row("b", { won: false }),
      row("b", { won: false }),
    ];

    const ranked = rankPlayers(rows);

    expect(ranked.find((p) => p.playerId === "a")?.winStreak).toBe(3);
    expect(ranked.find((p) => p.playerId === "b")?.winStreak).toBe(-2);
  });

  it("reports a zero streak for an even record ending in a win", () => {
    const rows = [row("a", { won: true }), row("a", { won: false }), row("a", { won: true })];

    expect(rankPlayers(rows)[0].winStreak).toBe(1);
  });

  it("averages partner skill across games with partners", () => {
    const rows = [
      row("a", { won: true, partnerIds: ["p"], partnerSkillTotal: 4 }),
      row("a", { won: true, partnerIds: ["q"], partnerSkillTotal: 2 }),
    ];

    expect(rankPlayers(rows)[0].averagePartnerSkill).toBe(3);
  });

  it("returns null average partner skill for singles", () => {
    const rows = [row("a", { won: true, partnerIds: [] })];

    expect(rankPlayers(rows)[0].averagePartnerSkill).toBeNull();
  });

  it("aggregates points across a player's games", () => {
    const rows = [
      row("a", { won: true, pointsFor: 11, pointsAgainst: 9 }),
      row("a", { won: false, pointsFor: 7, pointsAgainst: 11 }),
    ];

    const a = rankPlayers(rows)[0];

    expect(a.gamesPlayed).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.pointsFor).toBe(18);
    expect(a.pointsAgainst).toBe(20);
    expect(a.pointDifferential).toBe(-2);
  });

  it("filters out players below the minimum game count", () => {
    const rows = [row("a", { won: true }), row("a", { won: true }), row("b", { won: true })];

    const ranked = rankPlayers(rows, { minGames: 2 });

    expect(ranked.map((p) => p.playerId)).toEqual(["a"]);
  });

  it("carries the skill level onto the ranked row", () => {
    const rows = [row("a", { won: true, skillLevel: 4 })];

    expect(rankPlayers(rows)[0].skillLevel).toBe(4);
  });
});

describe("computeWinPercentages", () => {
  it("returns an exact ratio per player", () => {
    const rows = [
      row("a", { won: true }),
      row("a", { won: true }),
      row("a", { won: false }),
      row("b", { won: false }),
    ];

    const pct = computeWinPercentages(rows);

    expect(pct.a).toBeCloseTo(2 / 3, 10);
    expect(pct.b).toBe(0);
  });

  it("returns an empty object for no rows", () => {
    expect(computeWinPercentages([])).toEqual({});
  });
});

describe("formatPercent", () => {
  it("formats to one decimal place", () => {
    expect(formatPercent(2 / 3)).toBe("66.7%");
    expect(formatPercent(1)).toBe("100.0%");
    expect(formatPercent(0)).toBe("0.0%");
  });
});
