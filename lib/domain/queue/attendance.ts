import type { AttendanceStatus } from "@/lib/db/types";

/**
 * How the session screen describes each attendance state.
 *
 * "checked_out" is the one people misread: it means the player is on the
 * session roster but has not arrived yet, not that they are missing from the
 * club. A roster entry whose player row has gone reads differently again, so
 * the two never share a label.
 */
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  checked_out: "Not checked in",
  waiting: "Waiting",
  staged: "Getting ready",
  playing: "Playing",
  break: "On break",
  finished: "Done for the day",
};

/** Shown when a session_players row no longer resolves to a club player. */
export const MISSING_PLAYER_LABEL = "Player record unavailable";

/** True while the player still needs a Check In, so the button should show. */
export function needsCheckIn(status: AttendanceStatus): boolean {
  return status === "checked_out" || status === "finished";
}

/**
 * The label for one roster row.
 *
 * `playerMissing` is separate from the status because a dangling roster row is
 * a data problem, not an attendance state, and offering Check In for it would
 * only produce another failed write.
 */
export function rosterStateLabel(
  status: AttendanceStatus,
  playerMissing: boolean,
): string {
  return playerMissing ? MISSING_PLAYER_LABEL : ATTENDANCE_LABEL[status];
}

/**
 * The `players.id` that attendance RPCs expect.
 *
 * `session_players` rows carry two ids: `id` is the row's own primary key and
 * `player_id` is the club player it points at. Every attendance function takes
 * the club player, so passing the row id looks plausible and fails at the
 * database with "That player is not on this club roster".
 */
export function attendancePlayerId(row: {
  id: string;
  player_id: string;
}): string {
  return row.player_id;
}