/**
 * Pure helpers for organizer-created doubles partnerships.
 *
 * Nothing here imports React or Supabase. The database remains the authority on
 * whether a lock can be created or released; these helpers only make the same
 * eligibility rules legible to the UI and testable without a database.
 */

export const UNRESOLVED_MATCH_STATUSES = [
  "preparing",
  "up_next",
  "staged",
  "playing",
] as const;

export interface PartnerLockLike {
  id: string;
  player_a_id: string;
  player_b_id: string;
  player_a_name?: string;
  player_b_name?: string;
  player_a_skill?: number;
  player_b_skill?: number;
}

export interface PartnerRosterLike {
  player_id: string;
  display_name: string;
  skill_level: number;
  attendance_status: string;
  player_missing: boolean;
}

export interface PartnerMatchLike {
  status: string;
  players: Array<{ player_id: string }>;
}

export interface PlayerLock {
  lockId: string;
  partnerId: string;
  partnerName: string;
}

export function isUnresolvedMatchStatus(status: string): boolean {
  return (UNRESOLVED_MATCH_STATUSES as readonly string[]).includes(status);
}

/** playerId -> active lock and the other player in it. */
export function lockedPartnerMap(
  locks: PartnerLockLike[],
): Map<string, PlayerLock> {
  const map = new Map<string, PlayerLock>();
  for (const lock of locks) {
    map.set(lock.player_a_id, {
      lockId: lock.id,
      partnerId: lock.player_b_id,
      partnerName: lock.player_b_name ?? "Unknown",
    });
    map.set(lock.player_b_id, {
      lockId: lock.id,
      partnerId: lock.player_a_id,
      partnerName: lock.player_a_name ?? "Unknown",
    });
  }
  return map;
}

/** Players already in an unresolved lineup, and therefore unavailable to lock. */
export function unresolvedPlayerIds(matches: PartnerMatchLike[]): Set<string> {
  const ids = new Set<string>();
  for (const match of matches) {
    if (!isUnresolvedMatchStatus(match.status)) continue;
    for (const player of match.players) ids.add(player.player_id);
  }
  return ids;
}

/**
 * Players an organizer can choose when creating a lock: checked in and waiting,
 * not already locked, and not held by a lineup or match.
 */
export function eligibleLockPlayers<T extends PartnerRosterLike>(
  roster: T[],
  matches: PartnerMatchLike[],
  locks: PartnerLockLike[],
): T[] {
  const locked = lockedPartnerMap(locks);
  const reserved = unresolvedPlayerIds(matches);

  return roster
    .filter(
      (player) =>
        !player.player_missing &&
        player.attendance_status === "waiting" &&
        !locked.has(player.player_id) &&
        !reserved.has(player.player_id),
    )
    .sort(
      (a, b) =>
        a.display_name.localeCompare(b.display_name) ||
        a.player_id.localeCompare(b.player_id),
    );
}

export function averageSkill(a: number, b: number): string {
  return ((a + b) / 2).toFixed(1);
}
