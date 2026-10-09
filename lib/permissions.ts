import type { ClubRole, ClubWithMembership } from "@/lib/db/types";

/**
 * Club roles in the database are owner | admin | player. The UI talks about
 * "organizers" — anyone who can run a session — which maps to owner + admin,
 * the same pair private.is_club_admin() checks on the server. Keeping the
 * mapping in one place stops the UI and the RPCs from drifting apart.
 */
export function isClubAdmin(role: ClubRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function isClubOwner(role: ClubRole | null | undefined): boolean {
  return role === "owner";
}

export function canManageClub(
  club: Pick<ClubWithMembership, "viewer_role">,
): boolean {
  return isClubAdmin(club.viewer_role);
}

export function roleLabel(role: ClubRole | null | undefined): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Organizer";
    case "player":
      return "Player";
    default:
      return "Not a member";
  }
}
