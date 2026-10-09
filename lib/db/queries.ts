import { createClient } from "@/lib/supabase/server";
import type {
  ClubMember,
  ClubSettings,
  ClubWithMembership,
  Match,
  MatchPlayer,
  Player,
  PlayerLiveBoardPayload,
  PublicClub,
  PublicLiveCourt,
  PublicLiveSession,
  PublicMatchLineupRow,
  PublicMatchResult,
  PublicSessionPresenceRow,
  PublicSessionQueueRow,
  PublicSessionStanding,
  Session,
  SessionPlayer,
  SessionStanding,
  SupabaseClient,
} from "./types";

/**
 * Read helpers for the app.
 *
 * Every function here goes through RLS with the signed-in user, or reads one of
 * the four sanitized public views for anonymous traffic. Nothing here uses the
 * service-role key, and no helper filters rows client-side "for security" --
 * if a row should not be visible, the database decides.
 */

export type {
  Club,
  ClubMember,
  ClubSettings,
  ClubWithMembership,
  Court,
  Match,
  MatchPlayer,
  MatchResult,
  MatchStatus,
  Player,
  PlayerLiveBoardPayload,
  Profile,
  PublicClub,
  PublicLineupPlayer,
  PublicLineupSection,
  PublicLiveCourt,
  PublicLiveSession,
  PublicMatchLineupRow,
  PublicMatchResult,
  PublicSessionPresenceRow,
  PublicSessionQueueRow,
  PublicSessionStanding,
  QueueMatchStatus,
  Session,
  SessionPlayer,
  SessionStanding,
  SupabaseClient,
} from "./types";

/** Thrown when a query fails so callers can surface a real message. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

/**
 * Drops a joined relation from a row.
 *
 * The `select("*, players(...)")` pattern nests the relation under the table
 * name, which collides with the flattened columns we want. Rest-destructuring
 * is the clearest way to say "and not that key", and naming it `omit` in the
 * signature documents the intent at every call site.
 */
export function omitKey<K extends string, T extends Record<K, unknown>>(
  row: T,
  key: K,
): Omit<T, K> {
  const copy: Record<string, unknown> = { ...row };
  delete copy[key];
  return copy as Omit<T, K>;
}

function fail(error: { message: string; details?: string | null } | null) {
  if (error) {
    throw new DataError(error.message, error.details ?? undefined);
  }
}

export async function getViewerId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

/** Clubs the signed-in user belongs to, with the role that drives permissions. */
export async function getMyClubs(): Promise<ClubWithMembership[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("club_members")
    .select(
      "club_id, role, status, clubs(id, name, slug, location, timezone, logo_url, is_public, created_by, created_at, updated_at)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: true });

  fail(error);

  return (data ?? [])
    .map((row) => {
      const club = row.clubs as unknown as ClubWithMembership | null;
      if (!club) return null;
      return {
        ...club,
        viewer_role: row.role,
        viewer_status: row.status,
      };
    })
    .filter((c): c is ClubWithMembership => c !== null);
}

export async function getClubBySlug(
  slug: string,
): Promise<ClubWithMembership | null> {
  const supabase = await createClient();
  const viewerId = await getViewerId();

  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  fail(error);
  if (!data) return null;

  let viewer_role: ClubWithMembership["viewer_role"] = null;
  let viewer_status: ClubWithMembership["viewer_status"] = null;

  if (viewerId) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("role, status")
      .eq("club_id", data.id)
      .eq("user_id", viewerId)
      .maybeSingle();
    viewer_role = membership?.role ?? null;
    viewer_status = membership?.status ?? null;
  }

  return { ...(data as ClubWithMembership), viewer_role, viewer_status };
}

export async function getClubById(
  clubId: string,
): Promise<ClubWithMembership | null> {
  const supabase = await createClient();
  const viewerId = await getViewerId();

  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .maybeSingle();

  fail(error);
  if (!data) return null;

  let viewer_role: ClubWithMembership["viewer_role"] = null;
  let viewer_status: ClubWithMembership["viewer_status"] = null;

  if (viewerId) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("role, status")
      .eq("club_id", clubId)
      .eq("user_id", viewerId)
      .maybeSingle();
    viewer_role = membership?.role ?? null;
    viewer_status = membership?.status ?? null;
  }

  return { ...(data as ClubWithMembership), viewer_role, viewer_status };
}

/**
 * Session defaults for a club. Returns null when the club has no settings row
 * yet (the create_club RPC usually inserts one), so callers can fall back to
 * the schema defaults.
 */
export async function getClubSettings(
  clubId: string,
): Promise<ClubSettings | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("club_settings")
    .select("club_id, min_games_for_leaderboard, default_match_minutes, updated_at")
    .eq("club_id", clubId)
    .maybeSingle();

  fail(error);

  return (data as ClubSettings | null) ?? null;
}

/** A club member as the settings screen needs to show them. */
export interface ClubMemberRow {
  id: string;
  user_id: string;
  role: ClubMember["role"];
  status: ClubMember["status"];
  display_name: string | null;
  linked_player_id: string | null;
}

/**
 * Active members of a club. The display name comes from the roster rather than
 * `profiles`, because profiles are readable only by their owner, so the join
 * would come back empty for every other member.
 */
export async function getClubMembers(clubId: string): Promise<ClubMemberRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("club_members")
    .select("id, user_id, role, status")
    .eq("club_id", clubId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  fail(error);

  const members = data ?? [];
  if (members.length === 0) return [];

  const roster = await getRoster(clubId);
  const byUserId = new Map(
    roster
      .filter((player): player is Player & { user_id: string } =>
        Boolean(player.user_id),
      )
      .map((player) => [player.user_id, player]),
  );

  return members.map((row) => {
    const player = byUserId.get(row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      role: row.role as ClubMember["role"],
      status: row.status as ClubMember["status"],
      display_name: player?.display_name ?? null,
      linked_player_id: player?.id ?? null,
    };
  });
}

export async function getRoster(clubId: string): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("club_id", clubId)
    .order("display_name", { ascending: true });

  fail(error);
  return (data ?? []) as Player[];
}

export async function getClubSessions(clubId: string): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  fail(error);
  return (data ?? []) as Session[];
}

/**
 * Everything the live session screen needs in one call: the session, its
 * courts, the roster joined to players, and the matches in flight.
 */
export interface SessionBundle {
  session: Session;
  courts: SessionBundleCourt[];
  roster: SessionPlayer[];
  matches: MatchWithPlayers[];
}

export interface SessionBundleCourt {
  id: string;
  court_number: number;
  name: string | null;
  status: SessionBundleCourtStatus;
  ladder_position: number;
  match: MatchWithPlayers | null;
}

type SessionBundleCourtStatus =
  | "available"
  | "staged"
  | "playing"
  | "disabled";

export interface MatchWithPlayers extends Match {
  players: MatchPlayer[];
}

export async function getSessionBundle(
  sessionId: string,
): Promise<SessionBundle | null> {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  fail(sessionError);
  if (!session) return null;

  const [courtsRes, rosterRes, matchesRes] = await Promise.all([
    supabase
      .from("courts")
      .select("*")
      .eq("session_id", sessionId)
      .order("court_number", { ascending: true }),
    supabase
      .from("session_players")
      .select("*, players(display_name, skill_level)")
      .eq("session_id", sessionId)
      .order("queue_position", { ascending: true, nullsFirst: false }),
    supabase
      .from("matches")
      .select("*, courts(court_number, name)")
      .eq("session_id", sessionId)
      // The two queue stages are included so the organizer can see and edit
      // lineups that have no court yet. They are harmless to the court grid
      // below: matchByCourt only buckets matches that have a court_id.
      .in("status", ["preparing", "up_next", "staged", "playing"])
      .order("match_number", { ascending: true }),
  ]);

  fail(courtsRes.error);
  fail(rosterRes.error);
  fail(matchesRes.error);

  const matches = await attachMatchPlayers(supabase, matchesRes.data ?? []);

  const matchByCourt = new Map<string, MatchWithPlayers>();
  for (const match of matches) {
    if (match.court_id) matchByCourt.set(match.court_id, match);
  }

  return {
    session: session as Session,
    courts: (courtsRes.data ?? []).map((court) => ({
      id: court.id as string,
      court_number: court.court_number as number,
      name: court.name as string | null,
      status: court.status as SessionBundleCourtStatus,
      ladder_position: court.ladder_position as number,
      match: matchByCourt.get(court.id as string) ?? null,
    })),
    roster: (rosterRes.data ?? []).map((row) => {
      const player = row.players as unknown as {
        display_name: string;
        skill_level: number;
      } | null;
      const rest = omitKey(row, "players");
      return {
        ...(rest as Omit<
          SessionPlayer,
          "display_name" | "skill_level" | "player_missing"
        >),
        display_name: player?.display_name ?? "Unknown",
        skill_level: player?.skill_level ?? 3,
        // The embed is a left join, so a null here means the session_players
        // row has no club player behind it. Flag it rather than letting the UI
        // show a roster entry the database cannot act on.
        player_missing: player === null,
      } as SessionPlayer;
    }),
    matches,
  };
}

/** Fetches the players for the given matches in one round trip. */
async function attachMatchPlayers(
  supabase: SupabaseClient,
  matches: Array<Record<string, unknown>>,
): Promise<MatchWithPlayers[]> {
  if (matches.length === 0) return [];

  const ids = matches.map((m) => m.id as string);
  const { data, error } = await supabase
    .from("match_players")
    .select("*, players(display_name)")
    .in("match_id", ids);

  fail(error);

  const byMatch = new Map<string, MatchPlayer[]>();
  for (const row of data ?? []) {
    const player = row.players as unknown as { display_name: string } | null;
    const rest = omitKey(row, "players");
    const entry = {
      ...(rest as Omit<MatchPlayer, "display_name">),
      display_name: player?.display_name ?? "Unknown",
    } as MatchPlayer;
    const list = byMatch.get(entry.match_id) ?? [];
    list.push(entry);
    byMatch.set(entry.match_id, list);
  }

  return matches.map((match) => {
    const court = match.courts as unknown as
      | { court_number: number; name: string | null }
      | null
      | undefined;
    const rest = omitKey(match, "courts");
    const players = (byMatch.get(match.id as string) ?? []).sort(
      (a, b) => a.team_number - b.team_number || a.slot_number - b.slot_number,
    );
    return {
      ...(rest as Omit<Match, "players">),
      players,
      court_number: court?.court_number,
      court_name: court?.name,
    } as MatchWithPlayers;
  });
}

/** Recent completed matches, newest first. Used by the session history view. */
export async function getSessionHistory(
  sessionId: string,
): Promise<MatchWithPlayers[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*, courts(court_number, name)")
    .eq("session_id", sessionId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(50);

  fail(error);
  return attachMatchPlayers(supabase, (data ?? []) as Array<Record<string, unknown>>);
}

// ---------------------------------------------------------------------------
// Public reads. These use the sanitized views, so they work with no session.
// ---------------------------------------------------------------------------

export async function getPublicClub(slug: string): Promise<PublicClub | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_clubs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  fail(error);
  return (data as PublicClub | null) ?? null;
}

/** Resolves one session-specific capability without exposing the token in data. */
export async function getPlayerLiveBoard(
  publicToken: string,
): Promise<PlayerLiveBoardPayload | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_player_live_board", {
    p_public_token: publicToken,
  });

  fail(error);
  return (data as PlayerLiveBoardPayload | null) ?? null;
}

export async function getPublicClubSessions(
  clubId: string,
): Promise<PublicLiveSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_live_sessions")
    .select("*")
    .eq("club_id", clubId)
    .order("started_at", { ascending: false });

  fail(error);
  return (data ?? []) as PublicLiveSession[];
}

export async function getPublicStandings(
  sessionId: string,
): Promise<PublicSessionStanding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_session_standings")
    .select("*")
    .eq("session_id", sessionId)
    .order("wins", { ascending: false })
    .order("points_for", { ascending: false })
    .order("display_name", { ascending: true });

  fail(error);
  return (data ?? []) as PublicSessionStanding[];
}

/**
 * Who is waiting, in queue order, for the anonymous board.
 *
 * Reads the sanitized queue view rather than session_players so an anonymous
 * reader never receives a player_id for someone who has not played yet.
 */
export async function getPublicSessionQueue(
  sessionId: string,
): Promise<PublicSessionQueueRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_session_queue")
    .select("*")
    .eq("session_id", sessionId)
    .order("queue_position", { ascending: true });

  fail(error);
  return (data ?? []) as PublicSessionQueueRow[];
}

/**
 * Sanitized queue and attendance rows for the public Live Board.
 *
 * Unlike public_session_queue this includes staged, playing, break, finished,
 * and checked-out rows so a player can tell why somebody is not in the waiting
 * order. It still carries no player or auth identifier.
 */
export async function getPublicSessionPresence(
  sessionId: string,
): Promise<PublicSessionPresenceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_session_presence")
    .select("*")
    .eq("session_id", sessionId)
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("display_name", { ascending: true });

  fail(error);
  return (data ?? []) as PublicSessionPresenceRow[];
}

/**
 * Session standings for an organizer or club member.
 *
 * session_standings is declared security_invoker, so this reads under the
 * signed-in user's own privileges and RLS decides which sessions and rows are
 * visible. Unlike the public view it is not publish-gated: it is the
 * organizer's board, so it also covers a session that is still private.
 *
 * A player with no completed game is a row of zeroes, not a missing row.
 */
export async function getSessionStandings(
  sessionId: string,
): Promise<SessionStanding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_standings")
    .select("*")
    .eq("session_id", sessionId)
    .order("wins", { ascending: false })
    .order("points_for", { ascending: false })
    .order("display_name", { ascending: true });

  fail(error);
  return (data ?? []) as SessionStanding[];
}

/**
 * Court state for the anonymous live board, plus the lineups on each court.
 * Both come from sanitized views keyed by (session_id, court_number).
 */
export async function getPublicCourts(
  sessionId: string,
): Promise<PublicLiveCourt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_live_courts")
    .select("*")
    .eq("session_id", sessionId)
    .order("ladder_position", { ascending: true })
    .order("court_number", { ascending: true });

  fail(error);
  return (data ?? []) as PublicLiveCourt[];
}

export async function getPublicLineups(
  sessionId: string,
): Promise<PublicMatchLineupRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_match_lineups")
    .select("*")
    .eq("session_id", sessionId)
    .order("court_number", { ascending: true })
    .order("team_number", { ascending: true })
    .order("slot_number", { ascending: true });

  fail(error);
  return (data ?? []) as PublicMatchLineupRow[];
}

/**
 * All-time club results for the leaderboard, read from the public results
 * view. Ranking itself happens in lib/domain/leaderboard so it is unit tested;
 * this only fetches the per-game rows it needs.
 */
export async function getPublicClubResults(
  clubId: string,
): Promise<PublicMatchResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_match_results")
    .select("*")
    .eq("club_id", clubId);

  fail(error);
  return (data ?? []) as PublicMatchResult[];
}
