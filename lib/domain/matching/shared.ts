import {
  DEFAULT_REPEAT_HISTORY_LIMIT,
  SKIP_STARVATION_THRESHOLD,
  type CostBreakdown,
  type MatchingRules,
  type ProposalPlayer,
  type QueueCandidate,
  type RecentMatch,
  type TeamNumber,
} from "./types";

export function playersPerMatch(format: MatchingRules["format"]): 2 | 4 {
  return format === "singles" ? 2 : 4;
}

/**
 * Candidate pool window. Balanced inspects the first 4 (singles) or 8
 * (doubles) eligible players; Skill Separated needs the same window to look
 * for a tighter skill band.
 */
export function candidatePoolSize(format: MatchingRules["format"]): 4 | 8 {
  return format === "singles" ? 4 : 8;
}

/**
 * SOP eligibility rules. A player is eligible when they are checked in,
 * waiting, not in another match, not on break, and below the optional game
 * limit. Being staged/playing is already represented by attendanceStatus, and
 * queuePosition is null for anyone not in the queue.
 */
export function isEligible(
  candidate: QueueCandidate,
  rules: MatchingRules,
): boolean {
  if (candidate.attendanceStatus !== "waiting") return false;
  if (candidate.queuePosition === null) return false;
  if (rules.maxGames !== null && candidate.gamesPlayed >= rules.maxGames) {
    return false;
  }
  return true;
}

export function getEligiblePlayers(
  candidates: QueueCandidate[],
  rules: MatchingRules,
): QueueCandidate[] {
  return candidates.filter((c) => isEligible(c, rules));
}

/**
 * Timestamps arrive from PostgREST as ISO strings but callers sometimes hold a
 * Date. Normalizing here means the rest of the engine never branches on which.
 */
export function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Minutes since the player joined the queue. 0 when unknown. */
export function minutesWaiting(
  candidate: QueueCandidate,
  now: Date,
): number {
  const enqueued = toTime(candidate.lastEnqueuedAt);
  if (enqueued === null) return 0;
  return Math.max(0, (now.getTime() - enqueued) / 60_000);
}

/**
 * True when the player must not be passed over again, either because they
 * have waited past the session threshold or because the database has already
 * recorded two consecutive skips for them. Both routes lead to the same
 * guarantee: a starved player is always pulled into the candidate pool and
 * always carries a penalty if they are still left out.
 */
export function isStarved(
  candidate: QueueCandidate,
  rules: MatchingRules,
): boolean {
  return (
    minutesWaiting(candidate, rules.now) > rules.starvationThresholdMinutes ||
    candidate.timesSkipped >= SKIP_STARVATION_THRESHOLD
  );
}

/**
 * Shared deterministic tie-breaker order:
 *   1. queue position
 *   2. fewest games played
 *   3. longest time since last game
 *   4. stable player id
 */
export function compareCandidates(
  a: QueueCandidate,
  b: QueueCandidate,
): number {
  const aq = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
  const bq = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
  if (aq !== bq) return aq - bq;

  if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;

  // Players who never played sort as "longest ago".
  const at = toTime(a.lastPlayedAt) ?? Number.NEGATIVE_INFINITY;
  const bt = toTime(b.lastPlayedAt) ?? Number.NEGATIVE_INFINITY;
  if (at !== bt) return at - bt;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortByTieBreakers(candidates: QueueCandidate[]): QueueCandidate[] {
  return [...candidates].sort(compareCandidates);
}

/** Map each player to their index in the tie-broken queue. */
export function queueIndexMap(
  sorted: QueueCandidate[],
): Map<string, number> {
  const map = new Map<string, number>();
  sorted.forEach((c, index) => map.set(c.id, index));
  return map;
}

export interface PartnerAndOpponentHistory {
  /** playerId -> Set of player ids they have partnered with recently. */
  partners: Map<string, Set<string>>;
  /** playerId -> Set of player ids they have faced recently. */
  opponents: Map<string, Set<string>>;
}

/**
 * Derives recent partner/opponent sets from the last N completed matches.
 * Ordered most recent first.
 */
export function buildRepeatHistory(
  recentMatches: RecentMatch[],
  limit = DEFAULT_REPEAT_HISTORY_LIMIT,
): PartnerAndOpponentHistory {
  const partners = new Map<string, Set<string>>();
  const opponents = new Map<string, Set<string>>();

  const add = (map: Map<string, Set<string>>, key: string, value: string) => {
    let set = map.get(key);
    if (!set) {
      set = new Set<string>();
      map.set(key, set);
    }
    if (key !== value) set.add(value);
  };

  for (const match of recentMatches.slice(0, limit)) {
    const teams = [match.team1, match.team2];
    teams.forEach((team) => {
      for (const a of team) {
        for (const b of team) add(partners, a, b);
      }
    });
    for (const a of match.team1) {
      for (const b of match.team2) {
        add(opponents, a, b);
        add(opponents, b, a);
      }
    }
  }

  return { partners, opponents };
}

/** The most recent lastPlayedAt across the candidate set. */
function mostRecentPlayTime(sorted: QueueCandidate[]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const c of sorted) {
    const at = toTime(c.lastPlayedAt);
    if (at !== null) max = Math.max(max, at);
  }
  return max;
}

/**
 * Counts how many selected players were part of the most recently finished
 * game. They should normally sit behind players who were already waiting.
 */
export function consecutiveGamePenalty(
  selected: QueueCandidate[],
  sortedPool: QueueCandidate[],
): number {
  const latest = mostRecentPlayTime(sortedPool);
  if (!Number.isFinite(latest)) return 0;
  return selected.filter((c) => toTime(c.lastPlayedAt) === latest).length;
}

/** Total distance from the head of the queue: lower means earlier players. */
export function queueDisplacement(
  selected: QueueCandidate[],
  index: Map<string, number>,
): number {
  let total = 0;
  for (const c of selected) total += index.get(c.id) ?? 0;
  return total;
}

export function gamesPlayedSpread(selected: QueueCandidate[]): number {
  if (selected.length === 0) return 0;
  const games = selected.map((c) => c.gamesPlayed);
  return Math.max(...games) - Math.min(...games);
}

export function skillRangeOf(selected: QueueCandidate[]): number {
  if (selected.length === 0) return 0;
  const skills = selected.map((c) => c.skillLevel);
  return Math.max(...skills) - Math.min(...skills);
}

/** Number of selected players who would miss out despite being starved. */
export function starvationPenalty(
  selectedIds: Set<string>,
  starved: QueueCandidate[],
): number {
  let count = 0;
  for (const c of starved) {
    if (!selectedIds.has(c.id)) count += 1;
  }
  return count;
}

/** How many of the selected players are repeat partners from recent matches. */
export function repeatPartnerCount(
  selected: QueueCandidate[],
  assignment: Map<string, TeamNumber>,
  history: PartnerAndOpponentHistory,
): number {
  let pairs = 0;
  for (const player of selected) {
    const recent = history.partners.get(player.id);
    if (!recent) continue;
    for (const other of selected) {
      if (other.id === player.id) continue;
      if (assignment.get(player.id) !== assignment.get(other.id)) continue;
      if (recent.has(other.id)) pairs += 1;
    }
  }
  // Each pair is seen from both sides.
  return pairs / 2;
}

export function repeatOpponentCount(
  selected: QueueCandidate[],
  assignment: Map<string, TeamNumber>,
  history: PartnerAndOpponentHistory,
): number {
  let pairs = 0;
  for (const player of selected) {
    const recent = history.opponents.get(player.id);
    if (!recent) continue;
    for (const other of selected) {
      if (other.id === player.id) continue;
      if (assignment.get(player.id) === assignment.get(other.id)) continue;
      if (recent.has(other.id)) pairs += 1;
    }
  }
  return pairs / 2;
}

export function teamSkillDifference(
  selected: QueueCandidate[],
  assignment: Map<string, TeamNumber>,
): number {
  let team1 = 0;
  let team2 = 0;
  for (const c of selected) {
    if (assignment.get(c.id) === 1) team1 += c.skillLevel;
    else team2 += c.skillLevel;
  }
  return Math.abs(team1 - team2);
}

/**
 * Every way to split the selection into two teams.
 *
 * doubles: the three distinct pairings of four players.
 * singles: one split (first player vs second player).
 *
 * Locked pairs, when supplied, constrain the generated splits.
 */
export function teamPartitions(
  selected: QueueCandidate[],
  lockedPairs: string[][] = [],
): Map<string, TeamNumber>[] {
  const ids = selected.map((c) => c.id);
  const locked = lockedPairs
    .filter((pair) => pair.length === 2 && pair.every((id) => ids.includes(id)))
    .map((pair) => pair.slice().sort() as [string, string]);

  const results: Map<string, TeamNumber>[] = [];
  const seen = new Set<string>();

  const push = (team1Ids: string[], team2Ids: string[]) => {
    const signature = [...team1Ids].sort().join("|");
    if (seen.has(signature)) return;
    seen.add(signature);

    const assignment = new Map<string, TeamNumber>();
    for (const id of team1Ids) assignment.set(id, 1);
    for (const id of team2Ids) assignment.set(id, 2);

    // Honour locked pairs: both members must land on the same team.
    for (const [a, b] of locked) {
      if (assignment.get(a) !== assignment.get(b)) return;
    }

    results.push(assignment);
  };

  if (ids.length === 2) {
    push([ids[0]], [ids[1]]);
    return results;
  }

  const [a, b, c, d] = ids;
  push([a, b], [c, d]);
  push([a, c], [b, d]);
  push([a, d], [b, c]);
  return results;
}

/** Builds the proposal players array, assigning slots within each team. */
export function toProposalPlayers(
  selected: QueueCandidate[],
  assignment: Map<string, TeamNumber>,
): ProposalPlayer[] {
  const slots: Record<TeamNumber, number> = { 1: 0, 2: 0 };
  return selected.map((c) => {
    const teamNumber = assignment.get(c.id) ?? 1;
    slots[teamNumber] += 1;
    return {
      playerId: c.id,
      teamNumber,
      slotNumber: (slots[teamNumber] as 1 | 2),
      skillLevel: c.skillLevel,
    };
  });
}

export function emptyBreakdown(): CostBreakdown {
  return {
    queueDisplacement: 0,
    gamesPlayedSpread: 0,
    consecutiveGamePenalty: 0,
    teamSkillDifference: 0,
    repeatPartnerCount: 0,
    repeatOpponentCount: 0,
    starvationPenalty: 0,
    skillRange: 0,
  };
}

/**
 * The candidate window. Starved players are always included so the engine can
 * guarantee they are not passed over again.
 */
export function buildCandidatePool(
  sorted: QueueCandidate[],
  rules: MatchingRules,
): QueueCandidate[] {
  const size = candidatePoolSize(rules.format);
  const pool = new Map<string, QueueCandidate>();
  for (const c of sorted.slice(0, size)) pool.set(c.id, c);
  for (const c of sorted) {
    if (isStarved(c, rules)) pool.set(c.id, c);
  }
  return [...pool.values()];
}

/** All combinations of `size` items, in deterministic order. */
export function combinations<T>(items: T[], size: number): T[][] {
  const results: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === size) {
      results.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      acc.push(items[i]);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return results;
}

/** Stable ordering helper so equal-cost proposals resolve identically. */
export function selectionKey(selected: QueueCandidate[]): string {
  return selected
    .map((c) => c.id)
    .slice()
    .sort()
    .join(",");
}