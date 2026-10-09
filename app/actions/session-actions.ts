"use server";

import type { ActionState } from "./session-action-state";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DataError } from "@/lib/db/queries";
import { getAppUrl } from "@/lib/env";
import { resolveLiveBoardUrl } from "@/lib/domain/live-board/live-board-url";

import type {
  MatchingMode,
  SessionFormat,
  SupabaseClient,
  TargetScore,
  WinBy,
} from "@/lib/db/types";


/**
 * Server actions for club, roster, and session mutations.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Every write is an RPC call. The app has no service-role key, so the
 *     database functions ARE the write API, and they re-check authorization
 *     with private.is_club_admin() on every call. Never trust a check done in
 *     the UI.
 *  2. Zod validates shape before the call, so a malformed payload never
 *     reaches SQL. RPCs re-validate anyway; this just produces better messages.
 */




/** Turns a thrown Supabase error into a message safe to show a user. */
function messageFrom(error: unknown): string {
  if (error instanceof DataError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function rpc(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    // PostgREST surfaces the RAISE EXCEPTION text as the message, which is
    // exactly what we want the organizer to read.
    throw new DataError(error.message);
  }
  return data;
}

function requireAuth(): never {
  throw new DataError("You must be signed in to do that.");
}

/** Throws unless there is a signed-in user. Returns the client and user id. */
async function requireUser(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) requireAuth();
  return { supabase, userId: user.id };
}

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      "Use lowercase letters, numbers, and single dashes (for example harbour-club)",
  });

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

const createClubSchema = z.object({
  name: z.string().min(2).max(80),
  slug: slugSchema,
  location: z.string().max(160).optional(),
  timezone: z.string().min(1).max(64).default("UTC"),
});

export async function createClubAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createClubSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    location: formData.get("location") || undefined,
    timezone: formData.get("timezone") || "UTC",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid details",
      ok: false,
    };
  }

  try {
    await requireUser();
    const id = await rpc("create_club", {
      p_name: parsed.data.name,
      p_slug: parsed.data.slug,
      p_location: parsed.data.location ?? null,
      p_timezone: parsed.data.timezone,
    });
    revalidatePath("/clubs");
    return { error: null, ok: true, id: String(id) };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const updateClubSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  location: z.string().max(160).optional(),
  timezone: z.string().min(1).max(64).optional(),
  logoUrl: z.string().url().max(500).optional().or(z.literal("")),
  isPublic: z.boolean(),
});

export async function updateClubAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateClubSchema.safeParse({
    clubId: formData.get("clubId"),
    name: formData.get("name") || undefined,
    location: formData.get("location") || undefined,
    timezone: formData.get("timezone") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    // A checkbox is absent when unticked, so read presence rather than value.
    isPublic: formData.get("isPublic") === "on",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid details",
      ok: false,
    };
  }

  try {
    await requireUser();
    await rpc("update_club", {
      p_club_id: parsed.data.clubId,
      p_name: parsed.data.name ?? null,
      p_location: parsed.data.location ?? null,
      p_timezone: parsed.data.timezone ?? null,
      p_logo_url: parsed.data.logoUrl || null,
      p_is_public: parsed.data.isPublic,
    });
    revalidatePath("/clubs");
    revalidatePath(`/clubs/${parsed.data.clubId}`);
    return { error: null, ok: true, id: parsed.data.clubId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const updateSettingsSchema = z.object({
  clubId: z.string().uuid(),
  minGames: z.coerce.number().int().min(0).max(100),
  matchMinutes: z.coerce.number().int().min(5).max(60),
});

export async function updateClubSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateSettingsSchema.safeParse({
    clubId: formData.get("clubId"),
    minGames: formData.get("minGames"),
    matchMinutes: formData.get("matchMinutes"),
  });

  if (!parsed.success) {
    return { error: "Enter whole numbers in the expected range", ok: false };
  }

  try {
    await requireUser();
    await rpc("update_club_settings", {
      p_club_id: parsed.data.clubId,
      p_min_games: parsed.data.minGames,
      p_default_match_minutes: parsed.data.matchMinutes,
    });
    revalidatePath(`/clubs/${parsed.data.clubId}/settings`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const memberSchema = z.object({
  clubId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "player"]),
});

export async function setMemberRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = memberSchema.safeParse({
    clubId: formData.get("clubId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: "That role is not valid", ok: false };
  }

  try {
    await requireUser();
    await rpc("set_club_member_role", {
      p_club_id: parsed.data.clubId,
      p_user_id: parsed.data.userId,
      p_role: parsed.data.role,
    });
    revalidatePath(`/clubs/${parsed.data.clubId}/settings`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const addMemberSchema = z.object({
  clubId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = addMemberSchema.safeParse({
    clubId: formData.get("clubId"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return { error: "That is not a valid account id", ok: false };
  }

  try {
    await requireUser();
    await rpc("add_club_member", {
      p_club_id: parsed.data.clubId,
      p_user_id: parsed.data.userId,
    });
    revalidatePath(`/clubs/${parsed.data.clubId}/settings`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

const playerSchema = z.object({
  clubId: z.string().uuid(),
  displayName: z.string().min(1).max(80),
  skillLevel: z.coerce.number().int().min(1).max(6),
  division: z.string().max(40).optional(),
  userId: z.string().uuid().optional(),
});

export async function createPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = playerSchema.safeParse({
    clubId: formData.get("clubId"),
    displayName: formData.get("displayName"),
    skillLevel: formData.get("skillLevel"),
    division: formData.get("division") || undefined,
    userId: formData.get("userId") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the roster details",
      ok: false,
    };
  }

  try {
    await requireUser();
    const id = await rpc("create_player", {
      p_club_id: parsed.data.clubId,
      p_display_name: parsed.data.displayName,
      p_skill_level: parsed.data.skillLevel,
      p_division: parsed.data.division ?? null,
      p_user_id: parsed.data.userId ?? null,
    });
    revalidatePath(`/clubs/${parsed.data.clubId}/players`);
    return { error: null, ok: true, id: String(id) };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const updatePlayerSchema = z.object({
  playerId: z.string().uuid(),
  displayName: z.string().min(1).max(80),
  skillLevel: z.coerce.number().int().min(1).max(6),
  division: z.string().max(40).optional(),
  isActive: z.boolean(),
});

export async function updatePlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePlayerSchema.safeParse({
    playerId: formData.get("playerId"),
    displayName: formData.get("displayName"),
    skillLevel: formData.get("skillLevel"),
    division: formData.get("division") || undefined,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the roster details",
      ok: false,
    };
  }

  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("players")
      .select("club_id")
      .eq("id", parsed.data.playerId)
      .maybeSingle();
    if (error) throw new DataError(error.message);
    if (!data) return { error: "Player not found", ok: false };

    await rpc("update_player", {
      p_player_id: parsed.data.playerId,
      p_display_name: parsed.data.displayName,
      p_skill_level: parsed.data.skillLevel,
      p_division: parsed.data.division ?? null,
      p_is_active: parsed.data.isActive,
    });
    revalidatePath(`/clubs/${data.club_id}/players`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

export async function archivePlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const playerId = z.string().uuid().safeParse(formData.get("playerId"));
  if (!playerId.success) return { error: "Player not found", ok: false };

  try {
    const { supabase } = await requireUser();
    const { data } = await supabase
      .from("players")
      .select("club_id")
      .eq("id", playerId.data)
      .maybeSingle();

    await rpc("archive_player", { p_player_id: playerId.data });
    if (data) revalidatePath(`/clubs/${data.club_id}/players`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const createSessionSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().min(2).max(80),
  format: z.enum(["singles", "doubles"]),
  matchingMode: z.enum(["fifo", "balanced", "skill_separated"]),
  targetScore: z.coerce.number().int(),
  winBy: z.coerce.number().int(),
  courtCount: z.coerce.number().int().min(1).max(12),
  maxGames: z.coerce.number().int().min(0).max(100).optional(),
  starvationMinutes: z.coerce.number().int().min(1).max(120),
  isPublic: z.boolean(),
});

export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createSessionSchema.safeParse({
    clubId: formData.get("clubId"),
    name: formData.get("name"),
    format: formData.get("format"),
    matchingMode: formData.get("matchingMode"),
    targetScore: formData.get("targetScore"),
    winBy: formData.get("winBy"),
    courtCount: formData.get("courtCount"),
    maxGames: formData.get("maxGames") || undefined,
    starvationMinutes: formData.get("starvationMinutes") || 15,
    isPublic: formData.get("isPublic") === "on",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the session settings",
      ok: false,
    };
  }

  try {
    await requireUser();
    const id = await rpc("create_session", {
      p_club_id: parsed.data.clubId,
      p_name: parsed.data.name,
      p_format: parsed.data.format,
      p_matching_mode: parsed.data.matchingMode,
      p_target_score: parsed.data.targetScore,
      p_win_by: parsed.data.winBy,
      p_court_count: parsed.data.courtCount,
      p_max_games: parsed.data.maxGames ?? null,
      p_starvation_minutes: parsed.data.starvationMinutes,
    });

    // Visibility is only settable through update_session, so fold it in.
    if (parsed.data.isPublic) {
      await rpc("update_session", {
        p_session_id: String(id),
        p_is_public: true,
      });
    }

    revalidatePath(`/clubs/${parsed.data.clubId}/sessions`);
    return { error: null, ok: true, id: String(id) };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const updateSessionSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  courtCount: z.coerce.number().int().min(1).max(12).optional(),
  maxGames: z.coerce.number().int().min(0).max(100).optional(),
  starvationMinutes: z.coerce.number().int().min(1).max(120).optional(),
  isPublic: z.boolean().optional(),
  resultsPublished: z.boolean().optional(),
});

export async function updateSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const has = (key: string) => formData.get(key) !== null;
  const parsed = updateSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    name: formData.get("name") || undefined,
    courtCount: has("courtCount") ? formData.get("courtCount") : undefined,
    maxGames: has("maxGames") ? formData.get("maxGames") : undefined,
    starvationMinutes: has("starvationMinutes")
      ? formData.get("starvationMinutes")
      : undefined,
    isPublic: has("isPublic") ? formData.get("isPublic") === "on" : undefined,
    resultsPublished: has("resultsPublished")
      ? formData.get("resultsPublished") === "on"
      : undefined,
  });

  if (!parsed.success) {
    return { error: "Check the session settings", ok: false };
  }

  try {
    await requireUser();
    await rpc("update_session", {
      p_session_id: parsed.data.sessionId,
      p_name: parsed.data.name ?? null,
      p_court_count: parsed.data.courtCount ?? null,
      p_max_games: parsed.data.maxGames ?? null,
      p_starvation_minutes: parsed.data.starvationMinutes ?? null,
      p_is_public: parsed.data.isPublic ?? null,
      p_results_published: parsed.data.resultsPublished ?? null,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: parsed.data.sessionId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const sessionPlayersSchema = z.object({
  sessionId: z.string().uuid(),
  playerIds: z.array(z.string().uuid()).min(1),
});

export async function addSessionPlayersAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sessionPlayersSchema.safeParse({
    sessionId: formData.get("sessionId"),
    playerIds: formData.getAll("playerIds"),
  });

  if (!parsed.success) {
    return { error: "Pick at least one player", ok: false };
  }

  try {
    await requireUser();
    await rpc("add_session_players", {
      p_session_id: parsed.data.sessionId,
      p_player_ids: parsed.data.playerIds,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const sessionPlayerSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export async function checkInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sessionPlayerSchema.safeParse({
    sessionId: formData.get("sessionId"),
    playerId: formData.get("playerId"),
  });

  if (!parsed.success) return { error: "Player not found", ok: false };

  try {
    await requireUser();
    const position = await rpc("check_in_player", {
      p_session_id: parsed.data.sessionId,
      p_player_id: parsed.data.playerId,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: String(position) };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

export async function checkOutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sessionPlayerSchema.safeParse({
    sessionId: formData.get("sessionId"),
    playerId: formData.get("playerId"),
  });

  if (!parsed.success) return { error: "Player not found", ok: false };

  try {
    await requireUser();
    await rpc("set_attendance", {
      p_session_id: parsed.data.sessionId,
      p_player_id: parsed.data.playerId,
      p_status: "checked_out",
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

export async function setBreakAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = sessionPlayerSchema.safeParse({
    sessionId: formData.get("sessionId"),
    playerId: formData.get("playerId"),
  });

  if (!parsed.success) return { error: "Player not found", ok: false };

  try {
    await requireUser();
    await rpc("set_attendance", {
      p_session_id: parsed.data.sessionId,
      p_player_id: parsed.data.playerId,
      p_status: formData.get("to") === "queue" ? "waiting" : "break",
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

export async function startSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionId = z.string().uuid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) return { error: "Session not found", ok: false };

  try {
    await requireUser();
    const result = (await rpc("start_session", {
      p_session_id: sessionId.data,
    })) as { public_token?: unknown } | null;
    const publicToken = result?.public_token;
    if (typeof publicToken !== "string") {
      throw new DataError("The Player Live View token was not created.");
    }
    // Built through the shared resolver so the link the action returns obeys the
    // same rules as the QR dialog: never relative, never a wildcard bind address,
    // and localhost only when nothing else is reachable (the dialog then warns
    // instead of rendering a dead QR code).
    const browserOrigin = formData.get("browserOrigin");
    const publicUrl = resolveLiveBoardUrl({
      appUrl: getAppUrl(),
      browserOrigin: typeof browserOrigin === "string" ? browserOrigin : undefined,
      publicToken,
    }).url;
    revalidatePath(`/sessions/${sessionId.data}`);
    revalidatePath(`/live/${publicToken}`);
    return { error: null, ok: true, id: sessionId.data, url: publicUrl };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
  force: z.boolean(),
});

export async function endSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = endSessionSchema.safeParse({
    sessionId: formData.get("sessionId"),
    force: formData.get("force") === "on",
  });

  if (!parsed.success) return { error: "Session not found", ok: false };

  try {
    await requireUser();
    await rpc("end_session", {
      p_session_id: parsed.data.sessionId,
      p_force: parsed.data.force,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: parsed.data.sessionId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const courtStatusSchema = z.object({
  courtId: z.string().uuid(),
  status: z.enum(["available", "disabled"]),
});

export async function setCourtStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = courtStatusSchema.safeParse({
    courtId: formData.get("courtId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return { error: "Court not found", ok: false };

  try {
    const { supabase } = await requireUser();
    const { data: court } = await supabase
      .from("courts")
      .select("session_id")
      .eq("id", parsed.data.courtId)
      .maybeSingle();

    await rpc("set_court_status", {
      p_court_id: parsed.data.courtId,
      p_status: parsed.data.status,
    });
    if (court) revalidatePath(`/sessions/${court.session_id}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

// ---------------------------------------------------------------------------
// Matches
//
// There is deliberately no action that puts a lineup straight onto a court.
// stage_match used to do exactly that, which skipped the pipeline: no Preparation
// queue, no single Up Next, and no audit of how a lineup was built. Lineups are
// created, promoted and assigned through the actions in lineup-actions.ts, and the
// database refuses the old path for anything the pipeline has taken over.
// ---------------------------------------------------------------------------

export async function startMatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ matchId: z.string().uuid(), sessionId: z.string().uuid() })
    .safeParse({
      matchId: formData.get("matchId"),
      sessionId: formData.get("sessionId"),
    });

  if (!parsed.success) return { error: "Match not found", ok: false };

  try {
    await requireUser();
    await rpc("start_match", { p_match_id: parsed.data.matchId });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: parsed.data.matchId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const scoreSchema = z.object({
  matchId: z.string().uuid(),
  sessionId: z.string().uuid(),
  team1Score: z.coerce.number().int().min(0).max(99),
  team2Score: z.coerce.number().int().min(0).max(99),
});

/** Updates only the in-progress display score; completed results use complete_match. */
export async function updateRunningScoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scoreSchema.safeParse({
    matchId: formData.get("matchId"),
    sessionId: formData.get("sessionId"),
    team1Score: formData.get("team1Score"),
    team2Score: formData.get("team2Score"),
  });

  if (!parsed.success) return { error: "Enter both scores", ok: false };

  try {
    await requireUser();
    await rpc("set_running_score", {
      p_match_id: parsed.data.matchId,
      p_team1_score: parsed.data.team1Score,
      p_team2_score: parsed.data.team2Score,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: parsed.data.matchId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

export async function completeMatchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scoreSchema.safeParse({
    matchId: formData.get("matchId"),
    sessionId: formData.get("sessionId"),
    team1Score: formData.get("team1Score"),
    team2Score: formData.get("team2Score"),
  });

  if (!parsed.success) return { error: "Enter both scores", ok: false };

  try {
    await requireUser();
    await rpc("complete_match", {
      p_match_id: parsed.data.matchId,
      p_team1_score: parsed.data.team1Score,
      p_team2_score: parsed.data.team2Score,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: parsed.data.matchId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

const correctScoreSchema = scoreSchema.extend({
  reason: z.string().min(3).max(500),
});

export async function correctScoreAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = correctScoreSchema.safeParse({
    matchId: formData.get("matchId"),
    sessionId: formData.get("sessionId"),
    team1Score: formData.get("team1Score"),
    team2Score: formData.get("team2Score"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: "Both scores and a short reason are required", ok: false };
  }

  try {
    await requireUser();
    await rpc("correct_match_score", {
      p_match_id: parsed.data.matchId,
      p_team1_score: parsed.data.team1Score,
      p_team2_score: parsed.data.team2Score,
      p_reason: parsed.data.reason,
    });
    revalidatePath(`/sessions/${parsed.data.sessionId}`);
    return { error: null, ok: true, id: parsed.data.matchId };
  } catch (error) {
    return { error: messageFrom(error), ok: false };
  }
}

export type { MatchingMode, SessionFormat, TargetScore, WinBy };
