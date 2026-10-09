import { describe, expect, it } from "vitest";
import {
  stagedCourtNumbers,
  stagedLineupEntries,
  stagedMatchEntries,
  type LineupRowLike,
  type MatchLike,
} from "./up-next";

let lineupSeq = 0;

function lineup(overrides: Partial<LineupRowLike> = {}): LineupRowLike {
  lineupSeq += 1;
  return {
    court_number: 1,
    team_number: 1,
    slot_number: 1,
    display_name: "Player",
    lineup_id: `lineup-${lineupSeq}`,
    ...overrides,
  };
}

let playerSeq = 0;

function player(
  overrides: Partial<MatchLike["players"][number]> = {},
): MatchLike["players"][number] {
  playerSeq += 1;
  return {
    id: `match-player-${playerSeq}`,
    team_number: 1,
    slot_number: 1,
    display_name: "Player",
    ...overrides,
  };
}

function match(overrides: Partial<MatchLike> = {}): MatchLike {
  return {
    status: "staged",
    court_number: 1,
    players: [
      player({ team_number: 1, slot_number: 1, display_name: "Alice" }),
      player({ team_number: 2, slot_number: 1, display_name: "Bob" }),
    ],
    ...overrides,
  };
}

describe("stagedCourtNumbers", () => {
  it("keeps only courts with a staged match", () => {
    expect(
      [
        ...stagedCourtNumbers([
          { court_number: 1, match_status: "staged" },
          { court_number: 2, match_status: "playing" },
          { court_number: 3, match_status: "completed" },
          { court_number: 4, match_status: null },
        ]),
      ],
    ).toEqual([1]);
  });

  it("is empty when nothing is staged", () => {
    expect(
      stagedCourtNumbers([{ court_number: 1, match_status: null }]).size,
    ).toBe(0);
  });
});

describe("stagedLineupEntries", () => {
  it("excludes an in-play match even though its result is still null", () => {
    // The regression this guards: match_players.result is null for a playing
    // match too, so filtering lineups on result alone would put a live game on
    // "Up next" as well as on the court card.
    const staged = stagedCourtNumbers([
      { court_number: 1, match_status: "playing" },
      { court_number: 2, match_status: "staged" },
    ]);
    const entries = stagedLineupEntries(
      [
        lineup({ court_number: 1, display_name: "InPlay" }),
        lineup({ court_number: 2, display_name: "OnDeck" }),
      ],
      staged,
    );
    expect(entries.map((entry) => entry.display_name)).toEqual(["OnDeck"]);
  });

  it("carries the court, team, slot and name through unchanged", () => {
    const row = lineup({
      court_number: 3,
      team_number: 2,
      slot_number: 2,
      display_name: "Zoe",
      lineup_id: "lineup-zoe",
    });
    const entries = stagedLineupEntries(
      [row],
      stagedCourtNumbers([{ court_number: 3, match_status: "staged" }]),
    );
    expect(entries).toEqual([
      {
        court_number: 3,
        team_number: 2,
        slot_number: 2,
        display_name: "Zoe",
        lineup_id: "lineup-zoe",
      },
    ]);
  });

  it("gives two players sharing a display name distinct keys", () => {
    // The key must not be built from the name: a club can have two "Sam"s, and
    // keying on the name collapses them into one list item.
    const entries = stagedLineupEntries(
      [
        lineup({ display_name: "Sam", lineup_id: "lineup-a", slot_number: 1 }),
        lineup({ display_name: "Sam", lineup_id: "lineup-b", slot_number: 2 }),
      ],
      stagedCourtNumbers([{ court_number: 1, match_status: "staged" }]),
    );
    expect(new Set(entries.map((entry) => entry.lineup_id)).size).toBe(2);
  });

  it("returns nothing when no match is staged", () => {
    expect(
      stagedLineupEntries([lineup()], stagedCourtNumbers([])),
    ).toEqual([]);
  });
});

describe("stagedMatchEntries", () => {
  it("includes a staged match with its players", () => {
    const entries = stagedMatchEntries([match()]);
    expect(entries.map((entry) => [entry.team_number, entry.display_name])).toEqual([
      [1, "Alice"],
      [2, "Bob"],
    ]);
    expect(entries.every((entry) => entry.lineup_id.length > 0)).toBe(true);
  });

  it("keys players by their match_players id, not by team and slot", () => {
    // The regression this guards: (team_number, slot_number) is what the React
    // key used to be, and stage_match could put two players of one team in slot
    // 1, making two entries share a key. The ids stay distinct regardless.
    const entries = stagedMatchEntries([
      match({
        players: [
          player({ team_number: 1, slot_number: 1, display_name: "Alice" }),
          player({ team_number: 1, slot_number: 1, display_name: "Bob" }),
          player({ team_number: 2, slot_number: 2, display_name: "Cara" }),
          player({ team_number: 2, slot_number: 2, display_name: "Dan" }),
        ],
      }),
    ]);

    expect(entries).toHaveLength(4);
    expect(new Set(entries.map((entry) => entry.lineup_id)).size).toBe(4);
    // And the old key would have collapsed them, which is the point.
    expect(
      new Set(entries.map((entry) => `${entry.team_number}-${entry.slot_number}`))
        .size,
    ).toBe(2);
  });

  it("excludes a match that is already playing", () => {
    expect(stagedMatchEntries([match({ status: "playing" })])).toEqual([]);
  });

  it("excludes a match with no court", () => {
    expect(stagedMatchEntries([match({ court_number: null })])).toEqual([]);
    expect(stagedMatchEntries([match({ court_number: undefined })])).toEqual([]);
  });

  it("skips a player with no display name rather than rendering blank", () => {
    const entries = stagedMatchEntries([
      match({
        players: [
          player({ team_number: 1, slot_number: 1, display_name: "Alice" }),
          player({ team_number: 1, slot_number: 2, display_name: null }),
        ],
      }),
    ]);
    expect(entries.map((entry) => entry.display_name)).toEqual(["Alice"]);
  });

  it("keeps only the staged match when both a staged and a playing match exist", () => {
    const entries = stagedMatchEntries([
      match({ court_number: 1 }),
      match({ court_number: 2, status: "playing" }),
    ]);
    expect([...new Set(entries.map((entry) => entry.court_number))]).toEqual([1]);
  });
});