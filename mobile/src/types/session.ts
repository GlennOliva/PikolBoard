import type { Court, Match, MatchPlayer, Session, SessionPlayer } from "@/types/database";

/** A match plus its resolved player rows, the shape screens render. */
export interface MatchWithPlayers extends Match {
  players: MatchPlayer[];
  court_number?: number;
  court_name?: string | null;
}

export interface SessionBundleCourt {
  id: string;
  court_number: number;
  name: string | null;
  status: Court["status"];
  ladder_position: number;
  match: MatchWithPlayers | null;
}

/** Everything the live organizer screen needs in one call. */
export interface SessionBundle {
  session: Session;
  courts: SessionBundleCourt[];
  roster: SessionPlayer[];
  matches: MatchWithPlayers[];
}
