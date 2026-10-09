import type { MatchPlayer, SessionPlayer } from "@/types/database";

/** Splits a lineup's players into team 1 and team 2, each sorted by slot. */
export function groupTeams(players: MatchPlayer[]): {
  team1: MatchPlayer[];
  team2: MatchPlayer[];
} {
  const bySlot = (a: MatchPlayer, b: MatchPlayer) => a.slot_number - b.slot_number;
  return {
    team1: players.filter((p) => p.team_number === 1).sort(bySlot),
    team2: players.filter((p) => p.team_number === 2).sort(bySlot),
  };
}

/** "Alice / Bob" for a doubles pairing, or "Alice" for singles. */
export function teamLabel(players: MatchPlayer[]): string {
  return players.map((p) => p.display_name ?? "Unknown").join(" / ") || "Empty";
}

export interface LineupInput {
  playerIds: string[];
  teamNumbers: number[];
  slotNumbers: number[];
}

/** Parallel arrays the lineup RPCs expect, built from match_players rows. */
export function lineupInputFromPlayers(players: MatchPlayer[]): LineupInput {
  const sorted = [...players].sort(
    (a, b) => a.team_number - b.team_number || a.slot_number - b.slot_number,
  );
  return {
    playerIds: sorted.map((p) => p.player_id),
    teamNumbers: sorted.map((p) => p.team_number),
    slotNumbers: sorted.map((p) => p.slot_number),
  };
}

/**
 * Builds a 2- or 4-slot lineup from an ordered list of session players. The
 * matchmaker emits its own team/slot assignment; this is only for the manual
 * editor, which fills team 1 then team 2 in order.
 */
export function lineupInputFromSelection(
  selected: SessionPlayer[],
  format: "singles" | "doubles",
): LineupInput {
  const perTeam = format === "singles" ? 1 : 2;
  return {
    playerIds: selected.map((p) => p.player_id),
    teamNumbers: selected.map((_, index) => Math.floor(index / perTeam) + 1),
    slotNumbers: selected.map((_, index) => (index % perTeam) + 1),
  };
}

/** Roster available to be put on a new lineup: waiting or on break. */
export function availableForQueue(roster: SessionPlayer[]): SessionPlayer[] {
  return roster
    .filter((p) => !p.player_missing)
    .filter((p) => p.attendance_status === "waiting" || p.attendance_status === "break")
    .sort((a, b) => {
      const aPos = a.queue_position ?? Number.MAX_SAFE_INTEGER;
      const bPos = b.queue_position ?? Number.MAX_SAFE_INTEGER;
      return aPos - bPos || a.display_name.localeCompare(b.display_name);
    });
}
