/**
 * Pure domain types for the matching engine.
 *
 * Nothing in lib/domain imports React or Supabase. Everything here is
 * deterministic: given the same candidates, rules, and history you get the
 * same proposal, which is what makes the unit tests meaningful.
 */

export type SessionFormat = "singles" | "doubles";

export type MatchingMode = "fifo" | "balanced" | "skill_separated";

export type AttendanceStatus =
  | "checked_out"
  | "waiting"
  | "staged"
  | "playing"
  | "break"
  | "finished";

/** One player as the matchmaker sees them. */
export interface QueueCandidate {
  /** Roster player id. Also the final deterministic tie-breaker. */
  id: string;
  displayName: string;
  /** 1 (beginner) through 6 (advanced). */
  skillLevel: number;
  attendanceStatus: AttendanceStatus;
  /** FIFO ordering assigned by the database. Null when not queued. */
  queuePosition: number | null;
  gamesPlayed: number;
  /** How many times the matchmaker has passed this player over. */
  timesSkipped: number;
  /**
   * Accepts either shape. PostgREST returns ISO strings, while unit tests and
   * server code often hold Dates; shared.toTime normalizes both so the engine
   * never branches on the representation.
   */
  lastPlayedAt: Date | string | null;
  lastEnqueuedAt: Date | string | null;
}

/** A past match, used to discourage repeat partners and opponents. */
export interface RecentMatch {
  team1: string[];
  team2: string[];
}

export interface MatchingRules {
  format: SessionFormat;
  mode: MatchingMode;
  /** null means no game cap. */
  maxGames: number | null;
  starvationThresholdMinutes: number;
  /** Injected so waiting-time maths is deterministic in tests. */
  now: Date;
  /** How many recent matches to consider for repeat avoidance. */
  repeatHistoryLimit?: number;
  /**
   * Pairs that must not be split across teams (or must be kept together).
   * Empty for P0; the rule is honoured so P1 partner locking does not
   * require rewriting the engine.
   */
  lockedPairs?: string[][];
}

export type TeamNumber = 1 | 2;

export interface ProposalPlayer {
  playerId: string;
  teamNumber: TeamNumber;
  slotNumber: 1 | 2;
  skillLevel: number;
}

export interface CostBreakdown {
  queueDisplacement: number;
  gamesPlayedSpread: number;
  consecutiveGamePenalty: number;
  teamSkillDifference: number;
  repeatPartnerCount: number;
  repeatOpponentCount: number;
  /** Applied when an eligible player would be starved past the threshold. */
  starvationPenalty: number;
  /** Skill spread of the selected group (Skill Separated only). */
  skillRange: number;
}

export interface MatchProposal {
  players: ProposalPlayer[];
  /** Human readable, shown in the Up Next card. */
  explanation: string;
  cost: number;
  breakdown: CostBreakdown;
  /** Eligible players the proposal passed over. */
  skippedPlayerIds: string[];
  /** Estimated minutes until this player is picked up again. */
}

export type ProposalResult =
  | { ok: true; proposal: MatchProposal }
  | { ok: false; reason: NotEnoughPlayersReason; message: string; waiting: number };

export type NotEnoughPlayersReason =
  | "not_enough_players"
  | "game_limit_reached";

/** Weights are exported so the docs and tests can reference one source. */
export const BALANCED_WEIGHTS = {
  queueDisplacement: 100,
  gamesPlayedSpread: 60,
  consecutiveGamePenalty: 80,
  teamSkillDifference: 30,
  repeatPartnerCount: 25,
  repeatOpponentCount: 10,
} as const;

export const SKILL_SEPARATED_WEIGHTS = {
  queueDisplacement: 70,
  skillRange: 100,
  gamesPlayedSpread: 40,
  consecutiveGamePenalty: 80,
  repeatPartnerCount: 20,
} as const;

/** Large enough that a starved player is always chosen if at all possible. */
export const STARVATION_PENALTY = 1_000_000;

/** Matches considered when counting repeat partners/opponents. */
export const DEFAULT_REPEAT_HISTORY_LIMIT = 5;

/**
 * Consecutive recorded skips after which a player is guaranteed selection.
 * SOP: "apply a very large penalty after two skips so the player is included
 * in the next valid match."
 */
export const SKIP_STARVATION_THRESHOLD = 2;