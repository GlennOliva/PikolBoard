import { supabase } from "@/lib/supabase";
import { DataError, messageFrom } from "@/lib/errors";
import type {
  AttendanceStatus,
  CourtStatus,
  MatchingMode,
  SessionFormat,
  TargetScore,
  WinBy,
} from "@/types/database";

/**
 * Every mutation in the app goes through an RPC. The live tables have no
 * INSERT/UPDATE/DELETE policies for signed-in users, so the database is the
 * only writer and re-checks authorization on each call. These wrappers are thin
 * on purpose: validate nothing here that the RPC does not already enforce.
 */

type RpcArgs = Record<string, unknown>;

async function rpc<T = unknown>(name: string, args: RpcArgs): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new DataError(error.message, error.details ?? undefined);
  return data as T;
}

/** Normalizes an unknown failure into a user-facing message. */
export function messageFromError(error: unknown): string {
  return messageFrom(error);
}

export interface LineupPayload {
  match_id: string | null;
  status: string | null;
  promoted_match_id: string | null;
  court_number: number | null;
}

interface LineupInput {
  sessionId: string;
  playerIds: string[];
  teamNumbers: number[];
  slotNumbers: number[];
  explanation?: string | null;
  matchingMode?: MatchingMode | null;
}

export function createPreparationLineup(input: LineupInput): Promise<LineupPayload> {
  return rpc<LineupPayload>("create_preparation_lineup", {
    p_session_id: input.sessionId,
    p_player_ids: input.playerIds,
    p_team_numbers: input.teamNumbers,
    p_slot_numbers: input.slotNumbers,
    p_explanation: input.explanation ?? null,
    p_matching_mode: input.matchingMode ?? null,
  });
}

export function promoteLineup(matchId: string): Promise<LineupPayload> {
  return rpc<LineupPayload>("promote_preparation_match", { p_match_id: matchId });
}

export function demoteLineup(matchId: string): Promise<LineupPayload> {
  return rpc<LineupPayload>("demote_up_next_match", { p_match_id: matchId });
}

export function assignLineupToCourt(
  matchId: string,
  courtId: string,
): Promise<LineupPayload> {
  return rpc<LineupPayload>("assign_lineup_to_court", {
    p_match_id: matchId,
    p_court_id: courtId,
  });
}

export function updateLineupPlayers(input: {
  matchId: string;
  playerIds: string[];
  teamNumbers: number[];
  slotNumbers: number[];
}): Promise<LineupPayload> {
  return rpc<LineupPayload>("update_lineup_players", {
    p_match_id: input.matchId,
    p_player_ids: input.playerIds,
    p_team_numbers: input.teamNumbers,
    p_slot_numbers: input.slotNumbers,
  });
}

export function cancelLineup(matchId: string, reason?: string | null): Promise<LineupPayload> {
  return rpc<LineupPayload>("cancel_lineup", {
    p_match_id: matchId,
    p_reason: reason ?? null,
  });
}

export function startMatch(matchId: string): Promise<void> {
  return rpc("start_match", { p_match_id: matchId });
}

export function setRunningScore(
  matchId: string,
  team1Score: number,
  team2Score: number,
): Promise<void> {
  return rpc("set_running_score", {
    p_match_id: matchId,
    p_team1_score: team1Score,
    p_team2_score: team2Score,
  });
}

export function completeMatch(
  matchId: string,
  team1Score: number,
  team2Score: number,
): Promise<void> {
  return rpc("complete_match", {
    p_match_id: matchId,
    p_team1_score: team1Score,
    p_team2_score: team2Score,
  });
}

export function correctMatchScore(
  matchId: string,
  team1Score: number,
  team2Score: number,
  reason: string,
): Promise<void> {
  return rpc("correct_match_score", {
    p_match_id: matchId,
    p_team1_score: team1Score,
    p_team2_score: team2Score,
    p_reason: reason,
  });
}

export function startSession(sessionId: string): Promise<{ public_live_token?: string } | null> {
  return rpc("start_session", { p_session_id: sessionId });
}

export function endSession(sessionId: string, force: boolean): Promise<void> {
  return rpc("end_session", { p_session_id: sessionId, p_force: force });
}

export function setCourtStatus(courtId: string, status: CourtStatus): Promise<void> {
  return rpc("set_court_status", { p_court_id: courtId, p_status: status });
}

export function checkInPlayer(
  sessionId: string,
  playerId: string,
): Promise<number | null> {
  return rpc<number | null>("check_in_player", {
    p_session_id: sessionId,
    p_player_id: playerId,
  });
}

export function setAttendance(
  sessionId: string,
  playerId: string,
  status: AttendanceStatus,
): Promise<void> {
  return rpc("set_attendance", {
    p_session_id: sessionId,
    p_player_id: playerId,
    p_status: status,
  });
}

export function addSessionPlayers(
  sessionId: string,
  playerIds: string[],
): Promise<void> {
  return rpc("add_session_players", {
    p_session_id: sessionId,
    p_player_ids: playerIds,
  });
}

// --- Club / session management -------------------------------------------

export function createClub(input: {
  name: string;
  slug: string;
  location?: string | null;
  timezone: string;
}): Promise<string> {
  return rpc<string>("create_club", {
    p_name: input.name,
    p_slug: input.slug,
    p_location: input.location ?? null,
    p_timezone: input.timezone,
  });
}

export function createSession(input: {
  clubId: string;
  name: string;
  format: SessionFormat;
  matchingMode: MatchingMode;
  targetScore: TargetScore;
  winBy: WinBy;
  courtCount: number;
  maxGames?: number | null;
  starvationMinutes: number;
}): Promise<string> {
  return rpc<string>("create_session", {
    p_club_id: input.clubId,
    p_name: input.name,
    p_format: input.format,
    p_matching_mode: input.matchingMode,
    p_target_score: input.targetScore,
    p_win_by: input.winBy,
    p_court_count: input.courtCount,
    p_max_games: input.maxGames ?? null,
    p_starvation_minutes: input.starvationMinutes,
  });
}

export function updateSession(input: {
  sessionId: string;
  name?: string | null;
  courtCount?: number | null;
  maxGames?: number | null;
  starvationMinutes?: number | null;
  isPublic?: boolean | null;
  resultsPublished?: boolean | null;
}): Promise<void> {
  return rpc("update_session", {
    p_session_id: input.sessionId,
    p_name: input.name ?? null,
    p_court_count: input.courtCount ?? null,
    p_max_games: input.maxGames ?? null,
    p_starvation_minutes: input.starvationMinutes ?? null,
    p_is_public: input.isPublic ?? null,
    p_results_published: input.resultsPublished ?? null,
  });
}
