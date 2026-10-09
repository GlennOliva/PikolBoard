import { createClient } from "@/lib/supabase/server";

/**
 * Typed row shapes for the PickleBoard schema.
 *
 * These are hand-written rather than generated so the app compiles without a
 * `supabase gen types` step. When a column changes, this file is the one place
 * to update. Every read goes through the RLS-protected views or tables, so the
 * `Row` types describe what a permitted caller can see.
 */

export type ClubRole = "owner" | "admin" | "player";
export type MemberStatus = "invited" | "active" | "archived";
export type SessionStatus = "draft" | "active" | "completed" | "cancelled";
export type SessionFormat = "singles" | "doubles";
export type MatchingMode = "fifo" | "balanced" | "skill_separated";
export type AttendanceStatus =
  | "checked_out"
  | "waiting"
  | "staged"
  | "playing"
  | "break"
  | "finished";
export type CourtStatus = "available" | "staged" | "playing" | "disabled";
/**
 * The lineup pipeline, in order.
 *
 * `preparing` and `up_next` are the two queue stages and hold no court:
 * Preparation is the waiting room, Up Next is the single lineup that has been
 * stepped up to play first. `staged` is a lineup that has been given a court,
 * and from there the match is played. `preparing` and `up_next` were added by
 * migration 0015; the court stages were added by 0016 alongside the constraint
 * that only a court stage requires a court.
 */
export type MatchStatus =
  | "preparing"
  | "up_next"
  | "staged"
  | "playing"
  | "completed"
  | "cancelled";

/**
 * The two stages that hold no court, named as one type so a query filter and a
 * component prop cannot drift apart.
 */
export type QueueMatchStatus = Extract<MatchStatus, "preparing" | "up_next">;
export type MatchResult = "win" | "loss" | "cancelled";
export type TargetScore = 11 | 15 | 21;
export type WinBy = 1 | 2;

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  default_skill_level: number;
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  timezone: string;
  logo_url: string | null;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  status: MemberStatus;
  created_at: string;
}

export interface ClubSettings {
  club_id: string;
  min_games_for_leaderboard: number;
  default_match_minutes: number;
  updated_at: string;
}

export interface Player {
  id: string;
  club_id: string;
  user_id: string | null;
  display_name: string;
  skill_level: number;
  division: string | null;
  is_active: boolean;
}

export interface ClubSettings {
  club_id: string;
  min_games_for_leaderboard: number;
  default_match_minutes: number;
  skill_labels: Record<string, string>;
}

export interface Session {
  id: string;
  club_id: string;
  name: string;
  status: SessionStatus;
  format: SessionFormat;
  matching_mode: MatchingMode;
  target_score: number;
  win_by: number;
  court_count: number;
  max_games: number | null;
  starvation_threshold_minutes: number;
  is_public: boolean;
  results_published: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  public_live_token: string | null;
  player_live_enabled: boolean;
}

export interface Court {
  id: string;
  session_id: string;
  court_number: number;
  name: string | null;
  status: CourtStatus;
  ladder_position: number;
}

/** A session roster row joined with the player it refers to. */
export interface SessionPlayer {
  id: string;
  session_id: string;
  player_id: string;
  attendance_status: AttendanceStatus;
  queue_position: number | null;
  games_played: number;
  wins: number;
  losses: number;
  win_streak: number;
  points_for: number;
  points_against: number;
  times_skipped: number;
  checked_in_at: string | null;
  last_played_at: string | null;
  last_enqueued_at: string | null;
  display_name: string;
  skill_level: number;
  /**
   * True when the session_players row did not resolve to a club player, so the
   * roster entry is dangling. The FK cascade makes this rare, but it needs its
   * own state because Check In would fail for such a row.
   */
  player_missing: boolean;
}

export interface Match {
  id: string;
  session_id: string;
  /** Null for `preparing` and `up_next`; required from `staged` onwards. */
  court_id: string | null;
  match_number: number;
  status: MatchStatus;
  /**
   * Organizer-facing label such as "Court 3 vs Court 5". Falls back to
   * "Match {match_number}" in the UI when null, which is also what the public
   * RPC substitutes server-side so a spectator never sees an empty heading.
   */
  display_name: string | null;
  target_score: number;
  win_by: number;
  matching_mode: MatchingMode | null;
  explanation: string | null;
  team1_score: number | null;
  team2_score: number | null;
  winning_team: 1 | 2 | null;
  /** Set when the lineup was created, so Preparation can be ordered by age. */
  staged_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  court_number?: number;
  court_name?: string | null;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  session_id: string;
  player_id: string;
  team_number: 1 | 2;
  slot_number: number;
  skill_snapshot: number;
  result: MatchResult | null;
  points_for: number | null;
  points_against: number | null;
  created_at?: string;
  /**
   * Queue position held by this player when the lineup was built, so putting the
   * lineup back returns everyone to the depth they were picked from.
   */
  origin_queue_position?: number | null;
  display_name?: string;
}

export interface PublicClub {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  timezone: string;
  logo_url: string | null;
}

export interface PublicLiveSession {
  id: string;
  club_id: string;
  name: string;
  status: SessionStatus;
  format: SessionFormat;
  matching_mode: MatchingMode;
  target_score: number;
  win_by: number;
  court_count: number;
  started_at: string | null;
  ended_at: string | null;
  results_published: boolean;
  club_slug: string;
  club_name: string;
  club_location: string | null;
  /** Mean duration of completed timed matches, rounded to whole minutes. */
  avg_match_minutes: number | null;
  completed_match_count: number;
}

export interface PlayerLiveSession extends PublicLiveSession {
  club_logo_url: string | null;
  player_live_enabled: boolean;
}

export interface PublicLiveCourt {
  session_id: string;
  club_id: string;
  court_number: number;
  court_name: string | null;
  court_status: CourtStatus;
  ladder_position: number;
  match_status: MatchStatus | null;
  /** Match sequencing number; how a spectator names a game, e.g. "Match 4". */
  match_number: number | null;
  display_name: string | null;
  winning_team: 1 | 2 | null;
  target_score: number | null;
  match_started_at: string | null;
  match_completed_at: string | null;
  /** Running score while playing; final score after complete_match. */
  team1_score: number | null;
  team2_score: number | null;
}

export interface PublicMatchLineupRow {
  session_id: string;
  court_number: number;
  team_number: 1 | 2;
  slot_number: number;
  display_name: string;
  result: MatchResult | null;
  points_for: number | null;
  points_against: number | null;
  /**
   * Stable identity for the lineup row, used as the React key.
   *
   * Surrogate match_players id, not an identifier of the person on it -- the
   * public views deliberately expose no user, player, or auth ids. Not the same
   * as (team_number, slot_number): that tuple is unique only because the database
   * now forbids two players in one slot, and keying a list by the invariant it
   * depends on hides the violation instead of surfacing it.
   */
  lineup_id: string;
}

/** One player inside a queued lineup on the public board. */
export interface PublicLineupPlayer {
  team_number: 1 | 2;
  slot_number: number;
  display_name: string;
  skill_level: number;
  /** Surrogate match_players id, used as the React key. See lineup_id above. */
  lineup_id: string;
}

/**
 * One queued lineup on the public board: the whole roster for a single match, so
 * a card renders from one entry.
 *
 * Preparation and Up Next hold no court, which is why they cannot arrive through
 * public_match_lineups -- that view joins through courts. They come from the
 * token-scoped `get_player_live_board` payload instead, keyed by match_number so
 * the anonymous shape still exposes no row ids.
 */
export interface PublicLineupSection {
  match_id: string;
  match_number: number;
  /** Never null: the RPC substitutes "Match {n}" for a blank organizer label. */
  display_name: string;
  matching_mode: MatchingMode | null;
  stage: QueueMatchStatus;
  prepared_at: string | null;
  players: PublicLineupPlayer[];
}

export interface PublicMatchResult {
  club_id: string;
  session_id: string;
  match_id: string;
  completed_at: string;
  team_number: 1 | 2;
  player_id: string;
  display_name: string;
  skill_level: number;
  won: boolean;
  points_for: number;
  points_against: number;
  opponent_skill_total: number;
  opponent_count: number;
  opponent_ids: string[];
  partner_ids: string[];
  partner_skill_total: number;
}

/**
 * One row per arrived player, including players with no completed game.
 *
 * Both standings views start from session_players and left join the completed
 * match totals, so a zero-game player is a real row of zeroes rather than a
 * missing row. That is also why the game timestamps are nullable: they stay
 * null until the player actually finishes something.
 */
export interface SessionStanding {
  session_id: string;
  club_id: string;
  player_id: string;
  display_name: string;
  skill_level: number;
  games_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  first_game_at: string | null;
  last_game_at: string | null;
}

export type PublicSessionStanding = SessionStanding;

/**
 * Public waiting queue row. Deliberately carries no player_id: the queue view
 * is the one public read model that is joined on player, and spectators have no
 * use for the identifier.
 */
export interface PublicSessionQueueRow {
  session_id: string;
  display_name: string;
  skill_level: number;
  queue_position: number;
  /**
   * Stable identity for the queue row, used as the React key.
   *
   * Surrogate session_players id. queue_position is not it: positions are reused
   * as players cycle through matches, so keying on one lets a recycled row inherit
   * the previous occupant's element. display_name is not it either, since two
   * players on a club can share a name.
   */
  queue_entry_id: string;
}

/**
 * Sanitized attendance row for the player-facing Live Board.
 *
 * The database view intentionally carries no player, user, membership, or auth
 * id. `presence_id` is the surrogate session_players row key and exists only so
 * React can keep the same person-row mounted when queue positions change.
 */
export interface PublicSessionPresenceRow {
  session_id: string;
  display_name: string;
  skill_level: number;
  attendance_status: AttendanceStatus;
  queue_position: number | null;
  games_played: number;
  checked_in_at: string | null;
  last_enqueued_at: string | null;
  presence_id: string;
}

/** Entire token-scoped payload returned by get_player_live_board. */
export interface PlayerLiveBoardPayload {
  session: PlayerLiveSession;
  courts: PublicLiveCourt[];
  /** Only matches on a court: staged or playing. */
  lineups: PublicMatchLineupRow[];
  /** The one lineup stepped up to play next, if any. At most one per session. */
  up_next: PublicLineupSection[];
  /** Lineups still waiting in the Preparation queue, oldest first. */
  preparation: PublicLineupSection[];
  presence: PublicSessionPresenceRow[];
  standings: PublicSessionStanding[];
}

/** A club plus the viewer's membership, which drives what they may click. */
export interface ClubWithMembership extends Club {
  viewer_role: ClubRole | null;
  viewer_status: MemberStatus | null;
}

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
