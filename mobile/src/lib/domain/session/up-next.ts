/**
 * Which matches belong on "Up next".
 *
 * A staged match is one that has been put on a court but not started yet, so it
 * is the next thing that will happen. A match that is already `playing` is not
 * up next -- it is on the court card right now.
 *
 * Everything here is pure and unit tested.
 */

export interface CourtStatusLike {
  court_number: number;
  match_status: string | null;
}

export interface LineupRowLike {
  court_number: number;
  team_number: 1 | 2;
  slot_number: number;
  display_name: string;
  /** Surrogate key of the lineup row. See `UpNextEntry.lineup_id`. */
  lineup_id: string;
}

export interface MatchPlayerLike {
  id: string;
  team_number: 1 | 2;
  slot_number: number;
  display_name?: string | null;
}

export interface MatchLike {
  status: string;
  /** Absent when the match is not attached to a court. */
  court_number?: number | null;
  players: MatchPlayerLike[];
}

export interface UpNextEntry {
  court_number: number;
  team_number: 1 | 2;
  slot_number: number;
  display_name: string;
  /**
   * Stable identity for this lineup row, and the React key for it.
   *
   * Not (team_number, slot_number), which was unique by accident, and not
   * display_name, since two players on a club can share a name.
   */
  lineup_id: string;
}

export function stagedCourtNumbers(courts: CourtStatusLike[]): Set<number> {
  return new Set(
    courts
      .filter((court) => court.match_status === "staged")
      .map((court) => court.court_number),
  );
}

/** Entries for staged matches the organizer already has in hand. */
export function stagedMatchEntries(matches: MatchLike[]): UpNextEntry[] {
  return matches
    .filter((match) => match.status === "staged" && match.court_number != null)
    .flatMap((match) =>
      match.players
        .filter((player) => (player.display_name ?? "") !== "")
        .map((player) => ({
          court_number: match.court_number as number,
          team_number: player.team_number,
          slot_number: player.slot_number,
          display_name: player.display_name as string,
          lineup_id: player.id,
        })),
    );
}

/**
 * Entries for staged matches on the public board.
 *
 * `staged` is the set of court numbers from stagedCourtNumbers; lineups on any
 * other court are in play and already shown there.
 */
export function stagedLineupEntries(
  lineups: LineupRowLike[],
  staged: Set<number>,
): UpNextEntry[] {
  return lineups
    .filter((row) => staged.has(row.court_number))
    .map((row) => ({
      court_number: row.court_number,
      team_number: row.team_number,
      slot_number: row.slot_number,
      display_name: row.display_name,
      lineup_id: row.lineup_id,
    }));
}
