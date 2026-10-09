"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DataError, omitKey } from "@/lib/db/queries";
import { proposeMatch } from "@/lib/domain/matching";
import type { QueueCandidate, RecentMatch } from "@/lib/domain/matching/types";
import type { SessionBundle } from "@/lib/db/queries";

/**
 * Matchmaking action.
 *
 * The proposal is computed here on the server, not in the browser, because the
 * organizer screen is a Server Component and the pure engine is already
 * unit tested. The engine only ever *suggests*: create_preparation_lineup
 * re-validates that each selected player is still available, so a stale proposal
 * is rejected rather than double-booking someone.
 */

function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * No court.
 *
 * A lineup is built before it has anywhere to play. Since the pipeline introduced
 * Preparation, proposing a lineup and assigning it to a court are two separate
 * decisions, and requiring a free court to ask for a suggestion meant the
 * matchmaker went dead exactly when the pipeline was needed most: every court busy
 * with players who have not started yet.
 */
const proposalSchema = z.object({
  sessionId: z.string().uuid(),
});

export interface ProposalResponse {
  ok: boolean;
  error: string | null;
  /** The suggested lineup, ready to create. Null when nothing can be proposed. */
  lineup: ProposedLineup | null;
}

export interface ProposedLineup {
  playerIds: string[];
  teamNumbers: number[];
  slotNumbers: number[];
  explanation: string;
  matchingMode: string;
}

/**
 * Recent completed matches, shaped for the repeat-partner/opponent history the
 * engines read. Only the last few matter, per the SOP.
 */
async function loadRecentMatches(sessionId: string): Promise<RecentMatch[]> {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, completed_at")
    .eq("session_id", sessionId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(5);

  if (!matches || matches.length === 0) return [];

  const { data: players } = await supabase
    .from("match_players")
    .select("match_id, player_id, team_number")
    .in(
      "match_id",
      matches.map((m) => m.id),
    );

  const byMatch = new Map<string, Record<1 | 2, string[]>>();
  for (const row of players ?? []) {
    const teams = byMatch.get(row.match_id) ?? { 1: [], 2: [] };
    teams[row.team_number as 1 | 2].push(row.player_id);
    byMatch.set(row.match_id, teams);
  }

  return matches
    .map((m) => byMatch.get(m.id))
    .filter((t): t is Record<1 | 2, string[]> => t !== undefined)
    .map((t) => ({ team1: t[1], team2: t[2] }));
}

export async function buildProposalAction(
  input: z.infer<typeof proposalSchema>,
): Promise<ProposalResponse> {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "That request is not valid",
      lineup: null,
    };
  }

  try {
    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", parsed.data.sessionId)
      .maybeSingle();

    if (sessionError) throw new DataError(sessionError.message);
    if (!session)
      return {
        ok: false,
        error: "Session not found",
        lineup: null,
      };
    if (session.status !== "active") {
      return {
        ok: false,
        error: "The session is not live",
        lineup: null,
      };
    }

    const { data: roster, error: rosterError } = await supabase
      .from("session_players")
      .select("*, players(display_name, skill_level)")
      .eq("session_id", parsed.data.sessionId);

    if (rosterError) throw new DataError(rosterError.message);

    const candidates: QueueCandidate[] = (roster ?? []).map((row) => {
      const player = row.players as unknown as {
        display_name: string;
        skill_level: number;
      } | null;
      const rest = omitKey(row, "players");
      return {
        id: rest.player_id as string,
        displayName: player?.display_name ?? "Unknown",
        skillLevel: player?.skill_level ?? 3,
        attendanceStatus:
          rest.attendance_status as QueueCandidate["attendanceStatus"],
        queuePosition: rest.queue_position as number | null,
        gamesPlayed: rest.games_played as number,
        timesSkipped: rest.times_skipped as number,
        lastPlayedAt: rest.last_played_at as string | null,
        lastEnqueuedAt: rest.last_enqueued_at as string | null,
      };
    });

    const recent = await loadRecentMatches(parsed.data.sessionId);

    const result = proposeMatch(
      candidates,
      {
        format: session.format,
        mode: session.matching_mode,
        maxGames: session.max_games as number | null,
        starvationThresholdMinutes:
          session.starvation_threshold_minutes as number,
        now: new Date(),
      },
      recent,
    );

    if (!result.ok) {
      return { ok: false, error: result.message, lineup: null };
    }

    return {
      ok: true,
      error: null,
      lineup: {
        playerIds: result.proposal.players.map((p) => p.playerId),
        teamNumbers: result.proposal.players.map((p) => p.teamNumber),
        slotNumbers: result.proposal.players.map((p) => p.slotNumber),
        explanation: result.proposal.explanation,
        matchingMode: session.matching_mode,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error),
      lineup: null,
    };
  }
}

export type { SessionBundle };
