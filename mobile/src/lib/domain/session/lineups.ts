/**
 * The Preparation -> Up Next -> staged lineup pipeline, as pure functions.
 *
 * Nothing here imports React or Supabase.
 */

export type SessionFormat = "singles" | "doubles";

/** The two court-less stages. Kept as data so the query and the UI agree. */
export const QUEUE_STAGES = ["preparing", "up_next"] as const;

export type QueueStage = (typeof QUEUE_STAGES)[number];

/** Every court-holding stage, i.e. the ones the court grid renders. */
export const COURT_STAGES = ["staged", "playing"] as const;

export interface LineupPlayerLike {
  /** match_players.id. The React key: never the name, never the slot tuple. */
  id: string;
  /** players.id. The id the lineup RPCs expect. */
  player_id: string;
  team_number: 1 | 2;
  slot_number: number;
  display_name?: string | null;
  origin_queue_position?: number | null;
}

export interface LineupMatchLike {
  id: string;
  status: string;
  match_number: number;
  display_name?: string | null;
  explanation?: string | null;
  /** When the lineup was created. Preparation is ordered by this, oldest first. */
  staged_at?: string | null;
  court_id?: string | null;
  court_number?: number | null;
  court_name?: string | null;
  players: LineupPlayerLike[];
}

export interface CourtLike {
  id: string;
  court_number: number;
  name: string | null;
  status: string;
}

export interface RosterRowLike {
  id: string;
  player_id: string;
  display_name: string;
  attendance_status: string;
  skill_level: number;
  player_missing: boolean;
}

/** One rendered row: who is on the lineup, in which team and slot. */
export interface LineupEntry {
  lineup_id: string;
  player_id: string;
  display_name: string;
  team_number: 1 | 2;
  slot_number: number;
}

/** A lineup plus the copy that identifies it, ready for a card. */
export interface LineupGroup {
  match: LineupMatchLike;
  label: string;
  entries: LineupEntry[];
}

/**
 * How a lineup is named.
 *
 * The organizer can label a lineup ("Court 3 vs Court 5"); when they have not,
 * the match number is the stable identifier both boards fall back to. Never an
 * empty string, because an empty heading reads as a rendering bug.
 */
export function matchLabel(match: {
  display_name?: string | null;
  match_number: number;
}): string {
  const label = match.display_name?.trim();
  return label && label.length > 0 ? label : `Match ${match.match_number}`;
}

export function courtLabel(court: {
  court_number: number;
  name: string | null;
}): string {
  return court.name
    ? `Court ${court.court_number} · ${court.name}`
    : `Court ${court.court_number}`;
}

export function isQueueStage(status: string): status is QueueStage {
  return (QUEUE_STAGES as readonly string[]).includes(status);
}

export function entriesFor(match: LineupMatchLike): LineupEntry[] {
  return match.players
    .filter((player) => (player.display_name ?? "") !== "")
    .sort(
      (a, b) => a.team_number - b.team_number || a.slot_number - b.slot_number,
    )
    .map((player) => ({
      lineup_id: player.id,
      player_id: player.player_id,
      display_name: player.display_name as string,
      team_number: player.team_number,
      slot_number: player.slot_number,
    }));
}

export function groupFor(match: LineupMatchLike): LineupGroup {
  return { match, label: matchLabel(match), entries: entriesFor(match) };
}

/**
 * Lineups waiting in Preparation, oldest first.
 *
 * `staged_at` is null only for rows written before the column existed, so those
 * sort last instead of first.
 */
export function preparationGroups(matches: LineupMatchLike[]): LineupGroup[] {
  return matches
    .filter((match) => match.status === "preparing")
    .sort((a, b) => {
      const left = a.staged_at ? Date.parse(a.staged_at) : Number.POSITIVE_INFINITY;
      const right = b.staged_at ? Date.parse(b.staged_at) : Number.POSITIVE_INFINITY;
      return left - right || a.match_number - b.match_number;
    })
    .map(groupFor);
}

/**
 * The single Up Next lineup, or null.
 *
 * A partial unique index keeps this at one per session, so if more than one ever
 * arrives the oldest wins rather than the UI silently picking one at random.
 */
export function upNextGroup(matches: LineupMatchLike[]): LineupGroup | null {
  const queued = matches
    .filter((match) => match.status === "up_next")
    .sort((a, b) => a.match_number - b.match_number);
  return queued.length === 0 ? null : groupFor(queued[0]);
}

/** Lineups that are on a court: what the court grid and Up Next already show. */
export function courtLineups(matches: LineupMatchLike[]): LineupMatchLike[] {
  return matches.filter((match) =>
    (COURT_STAGES as readonly string[]).includes(match.status),
  );
}

/** Court ids a lineup can be assigned to right now. */
export function assignableCourts(courts: CourtLike[]): CourtLike[] {
  return courts.filter((court) => court.status === "available");
}

export interface LineupSlot {
  team: 1 | 2;
  slot: number;
}

export interface LineupSelection {
  team: 1 | 2;
  slot: number;
  /** null when the slot is empty, which is legal while editing. */
  player_id: string | null;
}

/**
 * The slots a lineup has, in render order.
 *
 * Singles is two slots, one per team, because a singles lineup is two players.
 */
export function lineupSlots(format: SessionFormat): LineupSlot[] {
  if (format === "singles") {
    return [
      { team: 1, slot: 1 },
      { team: 2, slot: 1 },
    ];
  }
  return [
    { team: 1, slot: 1 },
    { team: 1, slot: 2 },
    { team: 2, slot: 1 },
    { team: 2, slot: 2 },
  ];
}

export function selectionFromMatch(
  match: LineupMatchLike,
  format: SessionFormat,
): LineupSelection[] {
  return lineupSlots(format).map((slot) => {
    const found = match.players.find(
      (player) =>
        player.team_number === slot.team && player.slot_number === slot.slot,
    );
    return { ...slot, player_id: found ? found.player_id : null };
  });
}

/**
 * Roster rows a lineup may be edited with.
 *
 * Checked-out players are excluded because the RPC rejects them, and
 * player_missing rows are excluded because they cannot be named.
 */
export function selectableRoster(
  roster: RosterRowLike[],
  matches: LineupMatchLike[],
  currentMatchId: string,
): RosterRowLike[] {
  const reservedElsewhere = new Set<string>();
  const currentPlayers = new Set(
    matches
      .find((match) => match.id === currentMatchId)
      ?.players.map((player) => player.player_id) ?? [],
  );
  for (const match of matches) {
    if (match.id === currentMatchId) continue;
    if (!isQueueStage(match.status) && match.status !== "staged") continue;
    for (const player of match.players) reservedElsewhere.add(player.player_id);
  }

  return roster.filter(
    (row) =>
      !row.player_missing &&
      (row.attendance_status === "waiting" || currentPlayers.has(row.player_id)) &&
      !reservedElsewhere.has(row.player_id),
  );
}

/**
 * Why a selection cannot be saved, or null when it can.
 */
export function validateSelection(
  selections: LineupSelection[],
  format: SessionFormat,
): string | null {
  const expected = lineupSlots(format);
  if (selections.length !== expected.length) {
    return `A ${format} lineup needs exactly ${expected.length} players`;
  }

  const filled = selections.filter((selection) => selection.player_id !== null);
  if (filled.length !== expected.length) {
    const missing = expected.length - filled.length;
    return `${missing} slot${missing === 1 ? "" : "s"} still empty`;
  }

  const ids = filled.map((selection) => selection.player_id as string);
  if (new Set(ids).size !== ids.length) {
    return "The same player cannot be selected twice";
  }

  const perTeam = new Map<number, number>();
  for (const selection of selections) {
    perTeam.set(selection.team, (perTeam.get(selection.team) ?? 0) + 1);
  }
  const teamSizes = [...perTeam.values()];
  if (teamSizes.length === 2 && teamSizes[0] !== teamSizes[1]) {
    return "Both teams need the same number of players";
  }

  return null;
}

/**
 * Move a selection to a new slot, returning a new array.
 *
 * This swaps rather than overwrites.
 */
export function moveSelection(
  selections: LineupSelection[],
  from: { team: 1 | 2; slot: number },
  to: { team: 1 | 2; slot: number },
): LineupSelection[] {
  if (from.team === to.team && from.slot === to.slot) return selections;

  const moving = selections.find(
    (selection) => selection.team === from.team && selection.slot === from.slot,
  );
  if (!moving) return selections;

  const displaced = selections.find(
    (selection) => selection.team === to.team && selection.slot === to.slot,
  );

  return selections.map((selection) => {
    if (selection.team === from.team && selection.slot === from.slot) {
      return { ...selection, player_id: displaced ? displaced.player_id : null };
    }
    if (selection.team === to.team && selection.slot === to.slot) {
      return { ...selection, player_id: moving.player_id };
    }
    return selection;
  });
}

/** The parallel arrays `update_lineup_players` takes. */
export function selectionToArrays(
  selections: LineupSelection[],
): { playerIds: string[]; teamNumbers: number[]; slotNumbers: number[] } {
  return {
    playerIds: selections.map((selection) => selection.player_id as string),
    teamNumbers: selections.map((selection) => selection.team),
    slotNumbers: selections.map((selection) => selection.slot),
  };
}
