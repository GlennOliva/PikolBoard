import {
  groupTeams,
  teamLabel,
  lineupInputFromSelection,
  availableForQueue,
} from "@/lib/lineup";
import type { MatchPlayer, SessionPlayer } from "@/types/database";

function matchPlayer(
  overrides: Partial<MatchPlayer> & { id: string; team_number: 1 | 2; slot_number: number },
): MatchPlayer {
  return {
    match_id: "m1",
    session_id: "s1",
    player_id: overrides.id,
    skill_snapshot: 3,
    result: null,
    points_for: null,
    points_against: null,
    display_name: overrides.id,
    ...overrides,
  } as MatchPlayer;
}

function sessionPlayer(
  overrides: Partial<SessionPlayer> & { player_id: string; attendance_status: SessionPlayer["attendance_status"] },
): SessionPlayer {
  return {
    id: overrides.player_id,
    session_id: "s1",
    display_name: overrides.player_id,
    skill_level: 3,
    queue_position: null,
    games_played: 0,
    wins: 0,
    losses: 0,
    win_streak: 0,
    points_for: 0,
    points_against: 0,
    times_skipped: 0,
    checked_in_at: null,
    last_played_at: null,
    last_enqueued_at: null,
    player_missing: false,
    ...overrides,
  } as SessionPlayer;
}

describe("lineup helpers", () => {
  it("splits players into teams sorted by slot", () => {
    const players = [
      matchPlayer({ id: "a", team_number: 2, slot_number: 1 }),
      matchPlayer({ id: "b", team_number: 1, slot_number: 2 }),
      matchPlayer({ id: "c", team_number: 1, slot_number: 1 }),
    ];
    const { team1, team2 } = groupTeams(players);
    expect(team1.map((p) => p.player_id)).toEqual(["c", "b"]);
    expect(team2.map((p) => p.player_id)).toEqual(["a"]);
  });

  it("labels a team with names", () => {
    expect(teamLabel([matchPlayer({ id: "a", team_number: 1, slot_number: 1 })])).toBe("a");
  });

  it("assigns teams and slots from a selection order", () => {
    const selection = [
      sessionPlayer({ player_id: "a", attendance_status: "waiting" }),
      sessionPlayer({ player_id: "b", attendance_status: "waiting" }),
      sessionPlayer({ player_id: "c", attendance_status: "waiting" }),
      sessionPlayer({ player_id: "d", attendance_status: "waiting" }),
    ];
    const input = lineupInputFromSelection(selection, "doubles");
    expect(input.teamNumbers).toEqual([1, 1, 2, 2]);
    expect(input.slotNumbers).toEqual([1, 2, 1, 2]);
  });

  it("orders the available queue by position and excludes non-waiting players", () => {
    const roster = [
      sessionPlayer({ player_id: "b", attendance_status: "waiting", queue_position: 2 }),
      sessionPlayer({ player_id: "a", attendance_status: "waiting", queue_position: 1 }),
      sessionPlayer({ player_id: "c", attendance_status: "playing" }),
      sessionPlayer({ player_id: "d", attendance_status: "break" }),
    ];
    expect(availableForQueue(roster).map((p) => p.player_id)).toEqual(["a", "b", "d"]);
  });
});
