import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_LABEL,
  MISSING_PLAYER_LABEL,
  attendancePlayerId,
  needsCheckIn,
  rosterStateLabel,
} from "./attendance";

describe("ATTENDANCE_LABEL", () => {
  it("calls checked_out 'Not checked in' rather than implying absence", () => {
    // "not here yet" read as "this person is not on our roster", which is the
    // confusion this label caused.
    expect(ATTENDANCE_LABEL.checked_out).toBe("Not checked in");
  });

  it("labels every attendance status", () => {
    expect(ATTENDANCE_LABEL).toEqual({
      checked_out: "Not checked in",
      waiting: "Waiting",
      staged: "Getting ready",
      playing: "Playing",
      break: "On break",
      finished: "Done for the day",
    });
  });
});

describe("rosterStateLabel", () => {
  it("uses the attendance label for a resolvable roster row", () => {
    expect(rosterStateLabel("checked_out", false)).toBe("Not checked in");
    expect(rosterStateLabel("waiting", false)).toBe("Waiting");
    expect(rosterStateLabel("break", false)).toBe("On break");
  });

  it("reports a missing player record distinctly from not checked in", () => {
    expect(rosterStateLabel("checked_out", true)).toBe(
      MISSING_PLAYER_LABEL,
    );
    expect(MISSING_PLAYER_LABEL).toBe("Player record unavailable");
    expect(rosterStateLabel("checked_out", true)).not.toBe(
      ATTENDANCE_LABEL.checked_out,
    );
  });

  it("reports the missing record regardless of attendance state", () => {
    expect(rosterStateLabel("waiting", true)).toBe(MISSING_PLAYER_LABEL);
  });
});

describe("needsCheckIn", () => {
  it("offers check-in for players who have not arrived", () => {
    expect(needsCheckIn("checked_out")).toBe(true);
    expect(needsCheckIn("finished")).toBe(true);
  });

  it("does not offer check-in to players already on a court or waiting", () => {
    expect(needsCheckIn("waiting")).toBe(false);
    expect(needsCheckIn("staged")).toBe(false);
    expect(needsCheckIn("playing")).toBe(false);
    expect(needsCheckIn("break")).toBe(false);
  });
});

describe("attendancePlayerId", () => {
  it("returns players.id, not the session_players row id", () => {
    const row = {
      id: "1dc6f0f2-1f5a-4d54-9c1e-3a1f0c6b4a11",
      player_id: "ceae9a1a-e751-4875-8ce0-40192dd3e8ce",
    };
    // Passing row.id here made check_in_player reject a valid roster entry.
    expect(attendancePlayerId(row)).toBe(row.player_id);
    expect(attendancePlayerId(row)).not.toBe(row.id);
  });
});