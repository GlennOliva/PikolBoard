import { describe, expect, it } from "vitest";
import {
  averageSkill,
  eligibleLockPlayers,
  lockedPartnerMap,
  unresolvedPlayerIds,
} from "./partner-locks";

function player(
  id: string,
  attendanceStatus = "waiting",
  playerMissing = false,
) {
  return {
    player_id: id,
    display_name: id.toUpperCase(),
    skill_level: 3,
    attendance_status: attendanceStatus,
    player_missing: playerMissing,
  };
}

describe("partner lock helpers", () => {
  it("maps both players to the other member of the pair", () => {
    const map = lockedPartnerMap([
      {
        id: "lock-1",
        player_a_id: "a",
        player_b_id: "b",
        player_a_name: "Alex",
        player_b_name: "Blair",
      },
    ]);

    expect(map.get("a")).toEqual({
      lockId: "lock-1",
      partnerId: "b",
      partnerName: "Blair",
    });
    expect(map.get("b")?.partnerName).toBe("Alex");
  });

  it("finds players reserved in every unresolved lineup stage", () => {
    const ids = unresolvedPlayerIds([
      { status: "preparing", players: [{ player_id: "a" }] },
      { status: "up_next", players: [{ player_id: "b" }] },
      { status: "staged", players: [{ player_id: "c" }] },
      { status: "playing", players: [{ player_id: "d" }] },
      { status: "completed", players: [{ player_id: "history" }] },
    ]);

    expect([...ids].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("offers only waiting, available, unlocked roster players", () => {
    const roster = [
      player("eligible"),
      player("locked"),
      player("reserved"),
      player("break", "break"),
      player("missing", "waiting", true),
    ];
    const result = eligibleLockPlayers(
      roster,
      [{ status: "preparing", players: [{ player_id: "reserved" }] }],
      [
        {
          id: "lock-1",
          player_a_id: "locked",
          player_b_id: "other",
        },
      ],
    );

    expect(result.map((row) => row.player_id)).toEqual(["eligible"]);
  });

  it("formats the pair average to one decimal place", () => {
    expect(averageSkill(3, 4)).toBe("3.5");
    expect(averageSkill(4, 4)).toBe("4.0");
  });
});
