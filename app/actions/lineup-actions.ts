"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DataError } from "@/lib/db/queries";
import type { ActionState } from "./session-action-state";

/**
 * Server actions for the lineup pipeline.
 *
 * Each one is a thin wrapper over a single RPC from migration 0016. The wrapper
 * only validates shape and surfaces the SQL error text; every authorization and
 * state check stays in the database, because a browser can call any of these with
 * any argument and the RPC has to refuse it. Nothing here recomputes what the
 * RPC decides -- in particular `promoted_match_id` is passed straight back so the
 * UI can report which lineup stepped up.
 *
 * Every action takes the session id purely to revalidate the right path; the RPC
 * derives the session from the match, so a mismatched pair cannot escalate
 * anything.
 */

const idSchema = z.string().uuid();

const lineupInputSchema = z.object({
  matchId: idSchema,
  sessionId: idSchema,
});

const assignInputSchema = lineupInputSchema.extend({
  courtId: idSchema,
});

const playersInputSchema = lineupInputSchema.extend({
  playerIds: z.array(idSchema).min(2),
  teamNumbers: z.array(z.coerce.number().int().min(1).max(2)).min(2),
  slotNumbers: z.array(z.coerce.number().int().min(1).max(2)).min(2),
});

const createInputSchema = z.object({
  sessionId: idSchema,
  playerIds: z.array(idSchema).min(2),
  teamNumbers: z.array(z.coerce.number().int().min(1).max(2)).min(2),
  slotNumbers: z.array(z.coerce.number().int().min(1).max(2)).min(2),
  explanation: z.string().max(500).optional(),
  matchingMode: z.enum(["fifo", "balanced", "skill_separated"]).optional(),
});

export interface LineupActionResult {
  ok: boolean;
  /** PostgREST carries the RAISE EXCEPTION text, which is what we want to read. */
  error: string | null;
  matchId: string | null;
  /** The stage the match ended up in, when the RPC reports one. */
  status: string | null;
  /**
   * Which lineup was promoted as a side effect. Null when nothing was waiting,
   * which is normal rather than an error.
   */
  promotedMatchId: string | null;
  courtNumber: number | null;
}

function messageFrom(error: unknown): string {
  if (error instanceof DataError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function failed(error: string): LineupActionResult {
  return {
    ok: false,
    error,
    matchId: null,
    status: null,
    promotedMatchId: null,
    courtNumber: null,
  };
}

interface RpcPayload {
  match_id?: string;
  status?: string;
  promoted_match_id?: string | null;
  court_number?: number | null;
  court_id?: string | null;
}

/**
 * Reads the jsonb the RPCs return. Fields are optional because a mismatch here
 * must not turn a successful transition into a reported failure: the mutation
 * already committed, so the safest thing is to show it as done and omit the
 * extras.
 */
function readPayload(data: unknown): LineupActionResult {
  const payload = (data ?? {}) as RpcPayload;
  return {
    ok: true,
    error: null,
    matchId: payload.match_id ?? null,
    status: payload.status ?? null,
    promotedMatchId: payload.promoted_match_id ?? null,
    courtNumber: payload.court_number ?? null,
  };
}

/**
 * Runs one lineup RPC and normalizes the outcome.
 *
 * `sessionId` is passed for revalidation only, so a schema failure names the
 * caller-visible problem ("That lineup is no longer editable") instead of a Zod
 * message about a uuid.
 */
async function run(
  rpcName: string,
  args: Record<string, unknown>,
  sessionId: string,
): Promise<LineupActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpcName, args);
  if (error) return failed(error.message);

  revalidatePath(`/sessions/${sessionId}`);
  return readPayload(data);
}

/** Builds a Preparation lineup. Takes no court: that is a separate decision. */
export async function createPreparationLineupAction(
  input: z.infer<typeof createInputSchema>,
): Promise<LineupActionResult> {
  const parsed = createInputSchema.safeParse(input);
  if (!parsed.success) return failed("That lineup is not valid");
  if (
    parsed.data.playerIds.length !== parsed.data.teamNumbers.length ||
    parsed.data.playerIds.length !== parsed.data.slotNumbers.length
  ) {
    return failed("Each player needs a team and a slot");
  }

  try {
    return await run(
      "create_preparation_lineup",
      {
        p_session_id: parsed.data.sessionId,
        p_player_ids: parsed.data.playerIds,
        p_team_numbers: parsed.data.teamNumbers,
        p_slot_numbers: parsed.data.slotNumbers,
        p_explanation: parsed.data.explanation ?? null,
        p_matching_mode: parsed.data.matchingMode ?? null,
      },
      parsed.data.sessionId,
    );
  } catch (error) {
    return failed(messageFrom(error));
  }
}

/** Steps a waiting lineup up to Up Next. */
export async function promoteLineupAction(
  input: z.infer<typeof lineupInputSchema>,
): Promise<LineupActionResult> {
  const parsed = lineupInputSchema.safeParse(input);
  if (!parsed.success) return failed("That lineup is no longer in Preparation");

  try {
    return await run(
      "promote_preparation_match",
      { p_match_id: parsed.data.matchId },
      parsed.data.sessionId,
    );
  } catch (error) {
    return failed(messageFrom(error));
  }
}

/** Sends Up Next back to Preparation, freeing the pipeline slot. */
export async function demoteLineupAction(
  input: z.infer<typeof lineupInputSchema>,
): Promise<LineupActionResult> {
  const parsed = lineupInputSchema.safeParse(input);
  if (!parsed.success) return failed("That lineup is no longer Up Next");

  try {
    return await run(
      "demote_up_next_match",
      { p_match_id: parsed.data.matchId },
      parsed.data.sessionId,
    );
  } catch (error) {
    return failed(messageFrom(error));
  }
}

/** Puts a queued lineup on a court, which frees the Up Next slot. */
export async function assignLineupToCourtAction(
  input: z.infer<typeof assignInputSchema>,
): Promise<LineupActionResult> {
  const parsed = assignInputSchema.safeParse(input);
  if (!parsed.success) return failed("That lineup is no longer waiting for a court");

  try {
    return await run(
      "assign_lineup_to_court",
      { p_match_id: parsed.data.matchId, p_court_id: parsed.data.courtId },
      parsed.data.sessionId,
    );
  } catch (error) {
    return failed(messageFrom(error));
  }
}

/** Rewrites who is on a lineup that has not been played. */
export async function updateLineupPlayersAction(
  input: z.infer<typeof playersInputSchema>,
): Promise<LineupActionResult> {
  const parsed = playersInputSchema.safeParse(input);
  if (!parsed.success) return failed("That lineup cannot be saved");
  if (
    parsed.data.playerIds.length !== parsed.data.teamNumbers.length ||
    parsed.data.playerIds.length !== parsed.data.slotNumbers.length
  ) {
    return failed("Each player needs a team and a slot");
  }

  try {
    return await run(
      "update_lineup_players",
      {
        p_match_id: parsed.data.matchId,
        p_player_ids: parsed.data.playerIds,
        p_team_numbers: parsed.data.teamNumbers,
        p_slot_numbers: parsed.data.slotNumbers,
      },
      parsed.data.sessionId,
    );
  } catch (error) {
    return failed(messageFrom(error));
  }
}

/** Cancels a lineup and returns its players to the queue. */
export async function cancelLineupAction(
  input: z.infer<typeof lineupInputSchema>,
): Promise<LineupActionResult> {
  const parsed = lineupInputSchema.safeParse(input);
  if (!parsed.success) return failed("That lineup can no longer be cancelled");

  try {
    return await run(
      "cancel_lineup",
      { p_match_id: parsed.data.matchId, p_reason: null },
      parsed.data.sessionId,
    );
  } catch (error) {
    return failed(messageFrom(error));
  }
}

/**
 * Form-shaped wrapper for the court card, which drives its mutations through
 * useActionState.
 *
 * Same RPC as cancelLineupAction, and deliberately not cancel_match: that one
 * returns the players to the queue but leaves the pipeline where it was, so
 * cancelling a staged game would free a court while the Up Next slot sat empty
 * even though a Preparation lineup was waiting.
 */
export async function cancelLineupFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = lineupInputSchema.safeParse({
    matchId: formData.get("matchId"),
    sessionId: formData.get("sessionId"),
  });
  if (!parsed.success) return { error: "That lineup cannot be cancelled", ok: false };

  const result = await cancelLineupAction(parsed.data);
  return { ok: result.ok, error: result.error };
}
