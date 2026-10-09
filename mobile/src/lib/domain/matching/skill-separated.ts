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
  repeatPartnerCount,
  selectionKey,
  skillRangeOf,
  sortByTieBreakers,
  starvationPenalty,
  teamPartitions,
  teamSkillDifference,
  toProposalPlayers,
} from "./shared";
import {
  DEFAULT_REPEAT_HISTORY_LIMIT,
  SKILL_SEPARATED_WEIGHTS,
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
 * Skill Separated matching: start from the earliest waiting players and find
 * the group with the smallest skill spread.
 *
 *   total_cost =
 *     queue_displacement * 70
 *   + skill_range * 100
 *   + games_played_spread * 40
 *   + consecutive_game_penalty * 80
 *   + repeat_partner_count_last_5 * 20
 *
 * A player who has waited past the starvation threshold is always included,
 * otherwise the group suffers a penalty large enough to dominate every other
 * term. That is what stops outliers from waiting all night.
 */
export function proposeSkillSeparated(
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
      const range = skillRangeOf(group);
      const spread = gamesPlayedSpread(group);
      const consecutive = consecutiveGamePenalty(group, sorted);
      const repeats = repeatPartnerCount(group, assignment, history);
      const starvedOut = starvationPenalty(selectedIds, starved);

      const breakdown: CostBreakdown = {
        queueDisplacement: displacement,
        gamesPlayedSpread: spread,
        consecutiveGamePenalty: consecutive,
        teamSkillDifference: teamSkillDifference(group, assignment),
        repeatPartnerCount: repeats,
        repeatOpponentCount: 0,
        starvationPenalty: starvedOut,
        skillRange: range,
      };

      const cost =
        displacement * SKILL_SEPARATED_WEIGHTS.queueDisplacement +
        range * SKILL_SEPARATED_WEIGHTS.skillRange +
        spread * SKILL_SEPARATED_WEIGHTS.gamesPlayedSpread +
        consecutive * SKILL_SEPARATED_WEIGHTS.consecutiveGamePenalty +
        repeats * SKILL_SEPARATED_WEIGHTS.repeatPartnerCount +
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
      message: "No valid skill band could be formed from the waiting players.",
      waiting: sorted.length,
    };
  }

  const selectedIds = new Set(best.selected.map((c) => c.id));
  const forced = best.breakdown.starvationPenalty === 0 && starved.length > 0;

  return {
    ok: true,
    proposal: {
      players: toProposalPlayers(best.selected, best.assignment),
      explanation: explainSkillSeparated(best, sorted, selectedIds, starved.length, forced),
      cost: best.cost,
      breakdown: best.breakdown,
      skippedPlayerIds: sorted
        .filter((c) => !selectedIds.has(c.id))
        .map((c) => c.id),
    },
  };
}

function explainSkillSeparated(
  best: Scored,
  sorted: QueueCandidate[],
  selectedIds: Set<string>,
  starvedCount: number,
  forced: boolean,
): string {
  const levels = best.selected
    .map((c) => c.skillLevel)
    .sort((a, b) => a - b);
  const band =
    levels.length > 0 && levels[0] === levels[levels.length - 1]
      ? `all level ${levels[0]}`
      : `levels ${levels.join(" and ")}`;

  const parts: string[] = [`Tightest skill band: ${band}`];

  const earliest = sorted.findIndex((c) => selectedIds.has(c.id));
  parts.push(
    earliest === 0
      ? "starting from the front of the queue"
      : `starting from queue position ${earliest + 1}`,
  );

  if (best.breakdown.teamSkillDifference === 0) {
    parts.push("teams evenly matched");
  } else {
    parts.push(`team skill gap of ${best.breakdown.teamSkillDifference}`);
  }

  if (forced) {
    parts.push(
      `${starvedCount} player${starvedCount === 1 ? "" : "s"} included so nobody starves`,
    );
  }

  return `${parts.join("; ")}.`;
}
