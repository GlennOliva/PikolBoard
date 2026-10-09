import { describe, expect, it } from "vitest";
import {
  PODIUM_REQUIRED_GAMES,
  gamesToQualify,
  isQualified,
  qualificationLabel,
  qualifyPodium,
  rankLabel,
  type PodiumCandidate,
} from "./podium";

function candidate(
  playerId: string,
  gamesPlayed: number,
  rank: number,
): PodiumCandidate {
  return { playerId, gamesPlayed, rank };
}

describe("qualification threshold", () => {
  it("does not qualify at four completed games", () => {
    expect(isQualified({ games_played: 4 })).toBe(false);
    expect(qualificationLabel({ games_played: 4 })).toBe(
      "1 more game to qualify",
    );
  });

  it("qualifies at exactly five completed games", () => {
    expect(isQualified({ games_played: 5 })).toBe(true);
    expect(qualificationLabel({ games_played: 5 })).toBe("Qualified");
    expect(gamesToQualify({ games_played: 5 })).toBe(0);
  });

  it("stays qualified above the threshold", () => {
    expect(isQualified({ games_played: 6 })).toBe(true);
    expect(qualificationLabel({ games_played: 12 })).toBe("Qualified");
    expect(gamesToQualify({ games_played: 12 })).toBe(0);
  });

  it("counts from zero for a player who has not played", () => {
    expect(gamesToQualify({ games_played: 0 })).toBe(5);
    expect(qualificationLabel({ games_played: 0 })).toBe(
      "5 more games to qualify",
    );
  });

  it("never reports a negative shortfall", () => {
    expect(gamesToQualify({ games_played: 99 })).toBe(0);
  });

  it("honours a configured threshold", () => {
    expect(isQualified({ games_played: 3 }, 3)).toBe(true);
    expect(qualificationLabel({ games_played: 3 }, 10)).toBe(
      "7 more games to qualify",
    );
  });

  it("defaults to five", () => {
    expect(PODIUM_REQUIRED_GAMES).toBe(5);
  });
});

describe("qualification wording", () => {
  it("is singular at exactly one game short", () => {
    expect(qualificationLabel({ games_played: 4 })).toBe(
      "1 more game to qualify",
    );
  });

  it("is plural at two games short", () => {
    expect(qualificationLabel({ games_played: 3 })).toBe(
      "2 more games to qualify",
    );
  });

  it("switches to singular as a player closes in", () => {
    expect(qualificationLabel({ games_played: 0 })).toMatch(/games to qualify$/);
    expect(qualificationLabel({ games_played: 1 })).toMatch(/games to qualify$/);
    expect(qualificationLabel({ games_played: 4 })).toMatch(/game to qualify$/);
  });

  it("does not say '1 more games'", () => {
    expect(qualificationLabel({ games_played: 4 })).not.toContain("1 more games");
  });
});

describe("podium assignment", () => {
  it("awards gold, silver and bronze to the top three qualified players", () => {
    const rows = qualifyPodium([
      candidate("a", 6, 1),
      candidate("b", 5, 2),
      candidate("c", 5, 3),
      candidate("d", 2, 4),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([1, 2, 3, null]);
    expect(rows.map((entry) => entry.medal)).toEqual(["🥇", "🥈", "🥉", null]);
  });

  it("awards only gold when one player qualifies", () => {
    const rows = qualifyPodium([
      candidate("a", 5, 1),
      candidate("b", 4, 2),
      candidate("c", 3, 3),
      candidate("d", 1, 4),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([1, null, null, null]);
  });

  it("awards gold and silver but no bronze when two qualify", () => {
    const rows = qualifyPodium([
      candidate("a", 7, 1),
      candidate("b", 5, 2),
      candidate("c", 4, 3),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([1, 2, null]);
    expect(rows[2].medal).toBeNull();
  });

  it("never decorates an unqualified player", () => {
    const rows = qualifyPodium([
      candidate("top", 4, 1),
      candidate("second", 4, 2),
      candidate("third", 4, 3),
      candidate("qualified", 5, 4),
      candidate("other", 6, 5),
      candidate("third2", 5, 6),
    ]);
    const byId = new Map(rows.map((entry) => [entry.row.playerId, entry]));
    // The unqualified leaders on ranks 1-3 take nothing; podium goes to the
    // highest qualified players instead.
    expect(byId.get("top")!.podium).toBeNull();
    expect(byId.get("second")!.podium).toBeNull();
    expect(byId.get("third")!.podium).toBeNull();
    expect(byId.get("qualified")!.podium).toBe(1);
    expect(byId.get("other")!.podium).toBe(2);
    expect(byId.get("third2")!.podium).toBe(3);
  });

  it("keeps unqualified players visible with a shortfall label", () => {
    const rows = qualifyPodium([
      candidate("a", 6, 1),
      candidate("b", 3, 2),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].qualified).toBe(false);
    expect(rows[1].qualificationLabel).toBe("2 more games to qualify");
  });

  it("gives the tied leaders gold and silver by qualified position", () => {
    const rows = qualifyPodium([
      candidate("a", 5, 1),
      candidate("b", 5, 1),
      candidate("c", 5, 3),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([1, 2, 3]);
    // The rank column keeps the shared competition rank; only the medal differs.
    expect(rows.map((entry) => entry.rankLabel)).toEqual(["1st", "1st", "3rd"]);
  });

  it("awards all three medals when three qualified players share rank 1", () => {
    const rows = qualifyPodium([
      candidate("a", 5, 1),
      candidate("b", 5, 1),
      candidate("c", 5, 1),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([1, 2, 3]);
    expect(rows.map((entry) => entry.rankLabel)).toEqual(["1st", "1st", "1st"]);
  });

  it("gives gold to the single qualified player below an unqualified leader", () => {
    // Rule 10: one qualified player still takes gold, and the medal follows
    // qualified position rather than raw rank.
    const rows = qualifyPodium([
      candidate("leader", 4, 1),
      candidate("only", 5, 2),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([null, 1]);
  });

  it("handles a leaderboard with nobody qualified", () => {
    const rows = qualifyPodium([
      candidate("a", 2, 1),
      candidate("b", 1, 2),
    ]);
    expect(rows.map((entry) => entry.podium)).toEqual([null, null]);
    expect(rows.every((entry) => entry.qualified === false)).toBe(true);
  });

  it("recalculates when a fifth game promotes a player onto the podium", () => {
    const before = qualifyPodium([
      candidate("a", 8, 1),
      candidate("b", 4, 2),
      candidate("c", 3, 3),
    ]);
    expect(before.map((entry) => entry.podium)).toEqual([1, null, null]);

    const after = qualifyPodium([
      candidate("a", 8, 1),
      candidate("b", 5, 2),
      candidate("c", 3, 3),
    ]);
    expect(after.map((entry) => entry.podium)).toEqual([1, 2, null]);
    expect(after[1].qualificationLabel).toBe("Qualified");
  });

  it("preserves the incoming order and never re-sorts", () => {
    const rows = qualifyPodium([
      candidate("a", 9, 1),
      candidate("b", 7, 2),
      candidate("c", 6, 3),
    ]);
    expect(rows.map((entry) => entry.row.playerId)).toEqual(["a", "b", "c"]);
  });

  it("preserves displayed ranks verbatim, including gaps from shared ranks", () => {
    const rows = qualifyPodium([
      candidate("a", 9, 1),
      candidate("b", 9, 1),
      candidate("c", 7, 3),
      candidate("d", 6, 4),
    ]);
    expect(rows.map((entry) => entry.rankLabel)).toEqual(["1st", "1st", "3rd", "4th"]);
  });

  it("returns an empty result unchanged", () => {
    expect(qualifyPodium([])).toEqual([]);
  });

  it("carries extra row fields through untouched", () => {
    const rows = qualifyPodium([
      { ...candidate("a", 5, 1), display_name: "AG", wins: 5 },
    ]);
    expect(rows[0].row.display_name).toBe("AG");
    expect(rows[0].row.wins).toBe(5);
  });
});

describe("rankLabel", () => {
  it("uses the right ordinal suffix", () => {
    expect(rankLabel(1)).toBe("1st");
    expect(rankLabel(2)).toBe("2nd");
    expect(rankLabel(3)).toBe("3rd");
    expect(rankLabel(4)).toBe("4th");
  });

  it("handles teens", () => {
    expect(rankLabel(11)).toBe("11th");
    expect(rankLabel(12)).toBe("12th");
    expect(rankLabel(13)).toBe("13th");
    expect(rankLabel(21)).toBe("21st");
    expect(rankLabel(111)).toBe("111th");
  });
});