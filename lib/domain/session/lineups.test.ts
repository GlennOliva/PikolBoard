import { describe, expect, it } from "vitest";
import {
  lineupSlots,
  matchLabel,
  moveSelection,
  preparationGroups,
  selectableRoster,
  selectionFromMatch,
  selectionToArrays,
  upNextGroup,
  validateSelection,
  type LineupMatchLike,
  type RosterRowLike,
} from "./lineups";

function player(id: string, team: 1 | 2, slot: number) {
  return {
    id: `lineup-${id}`,
    player_id: id,
    team_number: team,
    slot_number: slot,
    display_name: id.toUpperCase(),
  };
}

function match(overrides: Partial<LineupMatchLike> = {}): LineupMatchLike {
  return {
    id: "match-1",
    status: "preparing",
    match_number: 1,
    display_name: null,
    staged_at: "2026-01-01T10:00:00Z",
    players: [
      player("a", 1, 1),
      player("b", 1, 2),
      player("c", 2, 1),
      player("d", 2, 2),
    ],
    ...overrides,
  };
}

function roster(
  id: string,
  attendanceStatus: string,
  overrides: Partial<RosterRowLike> = {},
): RosterRowLike {
  return {
    id: `session-${id}`,
    player_id: id,
    display_name: id.toUpperCase(),
    attendance_status: attendanceStatus,
    skill_level: 3,
    player_missing: false,
    ...overrides,
  };
}

describe("lineup groups", () => {
  it("uses a trimmed display name and falls back to the match number", () => {
    expect(matchLabel({ display_name: "  Friday Final  ", match_number: 8 })).toBe(
      "Friday Final",
    );
    expect(matchLabel({ display_name: " ", match_number: 8 })).toBe("Match 8");
  });

  it("orders Preparation oldest first and excludes other stages", () => {
    const groups = preparationGroups([
      match({ id: "new", match_number: 3, staged_at: "2026-01-01T10:10:00Z" }),
      match({ id: "playing", status: "playing", match_number: 2 }),
      match({ id: "old", match_number: 1, staged_at: "2026-01-01T09:50:00Z" }),
    ]);
    expect(groups.map((group) => group.match.id)).toEqual(["old", "new"]);
  });

  it("returns only the Up Next lineup", () => {
    expect(
      upNextGroup([
        match(),
        match({ id: "next", status: "up_next", match_number: 2 }),
      ])?.match.id,
    ).toBe("next");
    expect(upNextGroup([match()])).toBeNull();
  });
});

describe("lineup editing", () => {
  it("defines two singles slots and four doubles slots", () => {
    expect(lineupSlots("singles")).toEqual([
      { team: 1, slot: 1 },
      { team: 2, slot: 1 },
    ]);
    expect(lineupSlots("doubles")).toHaveLength(4);
  });

  it("keeps an empty slot when a stored doubles lineup is short", () => {
    const selections = selectionFromMatch(
      match({ players: [player("a", 1, 1), player("b", 2, 1), player("c", 2, 2)] }),
      "doubles",
    );
    expect(selections.find((selection) => selection.team === 1 && selection.slot === 2))
      .toMatchObject({ player_id: null });
  });

  it("offers waiting players and the current lineup, but not unavailable players", () => {
    const current = match();
    const other = match({
      id: "match-2",
      players: [player("reserved", 1, 1)],
    });
    const result = selectableRoster(
      [
        roster("waiting", "waiting"),
        roster("a", "staged"),
        roster("reserved", "staged"),
        roster("playing", "playing"),
        roster("break", "break"),
        roster("missing", "waiting", { player_missing: true }),
      ],
      [current, other],
      current.id,
    );
    expect(result.map((row) => row.player_id)).toEqual(["waiting", "a"]);
  });

  it("reports empty and duplicate selections before saving", () => {
    const base = selectionFromMatch(match(), "doubles");
    expect(validateSelection([{ ...base[0], player_id: null }, ...base.slice(1)], "doubles"))
      .toBe("1 slot still empty");
    expect(
      validateSelection(
        [{ ...base[0], player_id: "same" }, { ...base[1], player_id: "same" }, ...base.slice(2)],
        "doubles",
      ),
    ).toBe("The same player cannot be selected twice");
  });

  it("swaps occupied slots without losing either player", () => {
    const base = selectionFromMatch(match(), "doubles");
    const moved = moveSelection(base, { team: 1, slot: 1 }, { team: 2, slot: 1 });
    expect(moved.find((selection) => selection.team === 1 && selection.slot === 1)?.player_id)
      .toBe("c");
    expect(moved.find((selection) => selection.team === 2 && selection.slot === 1)?.player_id)
      .toBe("a");
  });

  it("serializes player, team, and slot arrays in the same order", () => {
    expect(selectionToArrays(selectionFromMatch(match(), "doubles"))).toEqual({
      playerIds: ["a", "b", "c", "d"],
      teamNumbers: [1, 1, 2, 2],
      slotNumbers: [1, 2, 1, 2],
    });
  });
});
