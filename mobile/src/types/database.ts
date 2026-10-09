/**
 * Typed row shapes for the PickleBoard schema, shared with the mobile client.
 *
 * Hand-written rather than generated so the app compiles without a
 * `supabase gen types` step. When a column changes, this file is the one place
 * to update. Reads go through the RLS-protected views or tables, so the `Row`
 * types describe what a permitted caller can see.
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
export type MatchStatus =
  | "preparing"
  | "up_next"
  | "staged"
  | "playing"
  | "completed"
  | "cancelled";

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
  skill_labels: Record<string, string>;
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
  player_missing: boolean;
}

export interface Match {
  id: string;
  session_id: string;
  court_id: string | null;
  match_number: number;
  status: MatchStatus;
  display_name: string | null;
  target_score: number;
  win_by: number;
  matching_mode: MatchingMode | null;
  explanation: string | null;
  team1_score: number | null;
  team2_score: number | null;
  winning_team: 1 | 2 | null;
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
  match_number: number | null;
  display_name: string | null;
  winning_team: 1 | 2 | null;
  target_score: number | null;
  match_started_at: string | null;
  match_completed_at: string | null;
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
  lineup_id: string;
}

export interface PublicLineupPlayer {
  team_number: 1 | 2;
  slot_number: number;
  display_name: string;
  skill_level: number;
  lineup_id: string;
}

export interface PublicLineupSection {
  match_id: string;
  match_number: number;
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

export interface PublicSessionQueueRow {
  session_id: string;
  display_name: string;
  skill_level: number;
  queue_position: number;
  queue_entry_id: string;
}

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

export interface PlayerLiveBoardPayload {
  session: PlayerLiveSession;
  courts: PublicLiveCourt[];
  lineups: PublicMatchLineupRow[];
  up_next: PublicLineupSection[];
  preparation: PublicLineupSection[];
  presence: PublicSessionPresenceRow[];
  standings: PublicSessionStanding[];
}

export interface ClubWithMembership extends Club {
  viewer_role: ClubRole | null;
  viewer_status: MemberStatus | null;
}
