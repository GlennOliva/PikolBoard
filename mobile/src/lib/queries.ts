import { supabase } from "@/lib/supabase";
import { fail } from "@/lib/errors";
import type {
  ClubWithMembership,
  ClubSettings,
  Court,
  Match,
  MatchPlayer,
  Player,
  PlayerLiveBoardPayload,
  PublicClub,
  Session,
  SessionPlayer,
  SessionStanding,
} from "@/types/database";
import type { MatchWithPlayers, SessionBundle, SessionBundleCourt } from "@/types/session";

export type { MatchWithPlayers, SessionBundle, SessionBundleCourt };

/**
 * Read helpers for the mobile app. Every function reads through RLS with the
 * signed-in user, or through the sanitized public views / RPCs for anonymous
 * traffic. Nothing filters rows client-side "for security": the database decides.
 */

export function omitKey<K extends string, T extends Record<K, unknown>>(
  row: T,
  key: K,
): Omit<T, K> {
  const copy: Record<string, unknown> = { ...row };
  delete copy[key];
  return copy as Omit<T, K>;
}

/** Clubs the signed-in user belongs to, with the role that drives permissions. */
export async function getMyClubs(): Promise<ClubWithMembership[]> {
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
      } as ClubWithMembership;
    })
    .filter((c): c is ClubWithMembership => c !== null);
}

export async function getClubById(
  clubId: string,
): Promise<ClubWithMembership | null> {
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .maybeSingle();

  fail(error);
  if (!data) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let viewer_role: ClubWithMembership["viewer_role"] = null;
  let viewer_status: ClubWithMembership["viewer_status"] = null;

  if (user) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("role, status")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .maybeSingle();
    viewer_role = membership?.role ?? null;
    viewer_status = membership?.status ?? null;
  }

  return { ...(data as ClubWithMembership), viewer_role, viewer_status };
}

export async function getClubSettings(
  clubId: string,
): Promise<ClubSettings | null> {
  const { data, error } = await supabase
    .from("club_settings")
    .select("*")
    .eq("club_id", clubId)
    .maybeSingle();

  fail(error);
  return (data as ClubSettings | null) ?? null;
}

export async function getRoster(clubId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  fail(error);
  return (data ?? []) as Player[];
}

export async function getClubSessions(clubId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  fail(error);
  return (data ?? []) as Session[];
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  fail(error);
  return (data as Session | null) ?? null;
}

/** Everything the live organizer screen needs in one call. */
export async function getSessionBundle(
  sessionId: string,
): Promise<SessionBundle | null> {
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
      status: court.status as Court["status"],
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
        player_missing: player === null,
      } as SessionPlayer;
    }),
    matches,
  };
}

type QueryClient = typeof supabase;

async function attachMatchPlayers(
  client: QueryClient,
  matches: Array<Record<string, unknown>>,
): Promise<MatchWithPlayers[]> {
  if (matches.length === 0) return [];

  const ids = matches.map((m) => m.id as string);
  const { data, error } = await client
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

export async function getSessionHistory(
  sessionId: string,
): Promise<MatchWithPlayers[]> {
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

export async function getMatchWithPlayers(
  matchId: string,
): Promise<MatchWithPlayers | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("*, courts(court_number, name)")
    .eq("id", matchId)
    .maybeSingle();

  fail(error);
  if (!data) return null;

  const [match] = await attachMatchPlayers(supabase, [data as Record<string, unknown>]);
  return match ?? null;
}

/** Recent completed matches shaped for the repeat-partner/opponent history. */
export async function getRecentMatches(
  sessionId: string,
  limit = 5,
): Promise<Array<{ team1: string[]; team2: string[] }>> {
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, completed_at")
    .eq("session_id", sessionId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);

  fail(error);
  if (!matches || matches.length === 0) return [];

  const { data: players, error: playersError } = await supabase
    .from("match_players")
    .select("match_id, player_id, team_number")
    .in(
      "match_id",
      matches.map((m) => m.id),
    );

  fail(playersError);

  const byMatch = new Map<string, { 1: string[]; 2: string[] }>();
  for (const row of players ?? []) {
    const teams = byMatch.get(row.match_id) ?? { 1: [], 2: [] };
    teams[row.team_number as 1 | 2].push(row.player_id);
    byMatch.set(row.match_id, teams);
  }

  return matches
    .map((m) => byMatch.get(m.id))
    .filter((t): t is { 1: string[]; 2: string[] } => t !== undefined)
    .map((t) => ({ team1: t[1], team2: t[2] }));
}

export async function getSessionStandings(
  sessionId: string,
): Promise<SessionStanding[]> {
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

// ---------------------------------------------------------------------------
// Public reads (anonymous-friendly).
// ---------------------------------------------------------------------------

export async function getPublicClub(slug: string): Promise<PublicClub | null> {
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
  const { data, error } = await supabase.rpc("get_player_live_board", {
    p_public_token: publicToken,
  });

  fail(error);
  return (data as PlayerLiveBoardPayload | null) ?? null;
}
