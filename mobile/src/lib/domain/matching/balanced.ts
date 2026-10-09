import { notEnoughPlayers } from "./fifo";
import {
  buildCandidatePool,
  buildRepeatHistory,
  combinations,
  consecutiveGamePenalty,
  gamesPlayedSpread,
  getEligiblePlayers,
  isStarved,
  playersPerMatch,
  queueDisplacement,
  queueIndexMap,
  repeatOpponentCount,
  repeatPartnerCount,
  selectionKey,
  sortByTieBreakers,
  starvationPenalty,
  teamPartitions,
  teamSkillDifference,
  toProposalPlayers,
} from "./shared";
import {
  BALANCED_WEIGHTS,
  DEFAULT_REPEAT_HISTORY_LIMIT,
  STARVATION_PENALTY,
  type CostBreakdown,
  type MatchingRules,
  type ProposalResult,
  type QueueCandidate,
  type RecentMatch,
  type TeamNumber,
} from "./types";

interface Scored {
  selected: QueueCandidate[];
  assignment: Map<string, TeamNumber>;
  cost: number;
  breakdown: CostBreakdown;
}

/**
 * Balanced matching. Waiting time is the first priority, team quality second.
 *
 *   total_cost =
 *     queue_displacement * 100
 *   + games_played_spread * 60
 *   + consecutive_game_penalty * 80
 *   + team_skill_difference * 30
 *   + repeat_partner_count_last_5 * 25
 *   + repeat_opponent_count_last_5 * 10
 *
 * A starved player who would still be left waiting adds a penalty large enough
 * to dominate every other term, so they are always picked up when the pool
 * allows it.
 */
export function proposeBalanced(
  candidates: QueueCandidate[],
  rules: MatchingRules,
  recentMatches: RecentMatch[] = [],
): ProposalResult {
  const sorted = sortByTieBreakers(getEligiblePlayers(candidates, rules));
  const size = playersPerMatch(rules.format);

  if (sorted.length < size) {
    return notEnoughPlayers(sorted.length, size, rules);
  }

  const pool = buildCandidatePool(sorted, rules);
  const index = queueIndexMap(sorted);
  const history = buildRepeatHistory(
    recentMatches,
    rules.repeatHistoryLimit ?? DEFAULT_REPEAT_HISTORY_LIMIT,
  );
  const starved = sorted.filter((c) => isStarved(c, rules));

  let best: Scored | null = null;
  let bestKey: string | null = null;

  for (const group of combinations(pool, size)) {
    const partitions = teamPartitions(group, rules.lockedPairs);
    if (partitions.length === 0) continue;

    for (const assignment of partitions) {
      const selectedIds = new Set(group.map((c) => c.id));
      const displacement = queueDisplacement(group, index);
      const spread = gamesPlayedSpread(group);
      const consecutive = consecutiveGamePenalty(group, sorted);
      const skillDiff = teamSkillDifference(group, assignment);
      const repeatPartners = repeatPartnerCount(group, assignment, history);
      const repeatOpponents = repeatOpponentCount(group, assignment, history);
      const starvedOut = starvationPenalty(selectedIds, starved);

      const breakdown: CostBreakdown = {
        queueDisplacement: displacement,
        gamesPlayedSpread: spread,
        consecutiveGamePenalty: consecutive,
        teamSkillDifference: skillDiff,
        repeatPartnerCount: repeatPartners,
        repeatOpponentCount: repeatOpponents,
        starvationPenalty: starvedOut,
        skillRange: 0,
      };

      const cost =
        displacement * BALANCED_WEIGHTS.queueDisplacement +
        spread * BALANCED_WEIGHTS.gamesPlayedSpread +
        consecutive * BALANCED_WEIGHTS.consecutiveGamePenalty +
        skillDiff * BALANCED_WEIGHTS.teamSkillDifference +
        repeatPartners * BALANCED_WEIGHTS.repeatPartnerCount +
        repeatOpponents * BALANCED_WEIGHTS.repeatOpponentCount +
        starvedOut * STARVATION_PENALTY;

      const key = selectionKey(group);
      if (
        best === null ||
        cost < best.cost ||
        (cost === best.cost && bestKey !== null && key < bestKey)
      ) {
        best = { selected: group, assignment, cost, breakdown };
        bestKey = key;
      }
    }
  }

  if (!best) {
    return {
      ok: false,
      reason: "not_enough_players",
      message: "No valid team split could be formed from the waiting players.",
      waiting: sorted.length,
    };
  }

  const selectedIds = new Set(best.selected.map((c) => c.id));

  return {
    ok: true,
    proposal: {
      players: toProposalPlayers(best.selected, best.assignment),
      explanation: explainBalanced(best, sorted, selectedIds, size),
      cost: best.cost,
      breakdown: best.breakdown,
      skippedPlayerIds: sorted
        .filter((c) => !selectedIds.has(c.id))
        .map((c) => c.id),
    },
  };
}

function explainBalanced(
  best: Scored,
  sorted: QueueCandidate[],
  selectedIds: Set<string>,
  size: number,
): string {
  const parts: string[] = [];

  const positions = sorted
    .filter((c) => selectedIds.has(c.id))
    .map((c) => c.id);
  const earliestIndex = sorted.findIndex((c) => selectedIds.has(c.id));
  const isHeadOfQueue =
    sorted.slice(0, size).every((c) => selectedIds.has(c.id));
  const isFifoLike = isHeadOfQueue && positions.length === size;

  if (isFifoLike && earliestIndex === 0) {
    parts.push(`Longest wait and closest team balance (${size} earliest players)`);
  } else {
    parts.push(
      `Selected for the longest wait while keeping teams balanced (queue positions ${positions
        .map((id) => sorted.findIndex((c) => c.id === id) + 1)
        .sort((a, b) => a - b)
        .join(", ")})`,
    );
  }

  if (best.breakdown.teamSkillDifference === 0) {
    parts.push("teams evenly matched on skill");
  } else {
    parts.push(`team skill gap of ${best.breakdown.teamSkillDifference}`);
  }

  if (best.breakdown.repeatPartnerCount > 0) {
    parts.push(
      `avoiding ${best.breakdown.repeatPartnerCount} recent repeat partnership(s)`,
    );
  }

  if (best.breakdown.starvationPenalty > 0) {
    parts.push("forced by a player nearing the starvation threshold");
  }

  return `${parts.join("; ")}.`;
}
