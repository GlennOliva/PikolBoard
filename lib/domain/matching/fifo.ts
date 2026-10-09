import {
  buildRepeatHistory,
  combinations,
  getEligiblePlayers,
  playersPerMatch,
  queueIndexMap,
  sortByTieBreakers,
  teamPartitions,
  teamSkillDifference,
  toProposalPlayers,
  repeatPartnerCount,
} from "./shared";
import {
  DEFAULT_REPEAT_HISTORY_LIMIT,
  type CostBreakdown,
  type MatchingRules,
  type ProposalResult,
  type QueueCandidate,
  type RecentMatch,
} from "./types";

export function notEnoughPlayers(
  waiting: number,
  required: number,
  rules: MatchingRules,
): ProposalResult {
  return {
    ok: false,
    reason: "not_enough_players",
    message:
      waiting < required
        ? `Only ${waiting} player${waiting === 1 ? "" : "s"} waiting. You need ${required} for a ${rules.format} match.`
        : "No valid match can be formed right now.",
    waiting,
  };
}

/**
 * First-Come-First-Out: take the first N players by the shared tie-breakers,
 * then split them into the most balanced teams.
 */
export function proposeFifo(
  candidates: QueueCandidate[],
  rules: MatchingRules,
  recentMatches: RecentMatch[] = [],
): ProposalResult {
  // Filter here as well as in proposeMatch so a direct caller cannot stage a
  // player who is playing, on break, or checked out.
  const sorted = sortByTieBreakers(getEligiblePlayers(candidates, rules));
  const size = playersPerMatch(rules.format);

  if (sorted.length < size) {
    return notEnoughPlayers(sorted.length, size, rules);
  }

  const selected = sorted.slice(0, size);
  const index = queueIndexMap(sorted);
  const history = buildRepeatHistory(
    recentMatches,
    rules.repeatHistoryLimit ?? DEFAULT_REPEAT_HISTORY_LIMIT,
  );

  const partitions = teamPartitions(selected, rules.lockedPairs);

  let bestAssignment = partitions[0];
  let bestCost = Number.POSITIVE_INFINITY;
  let bestDifference = Number.POSITIVE_INFINITY;
  let bestRepeatPartners = Number.POSITIVE_INFINITY;

  for (const assignment of partitions) {
    const difference = teamSkillDifference(selected, assignment);
    const repeats = repeatPartnerCount(selected, assignment, history);
    const cost = difference * 10 + repeats;
    if (cost < bestCost) {
      bestCost = cost;
      bestDifference = difference;
      bestRepeatPartners = repeats;
      bestAssignment = assignment;
    }
  }

  const breakdown: CostBreakdown = {
    queueDisplacement: selected.reduce((sum, c) => sum + (index.get(c.id) ?? 0), 0),
    gamesPlayedSpread: 0,
    consecutiveGamePenalty: 0,
    teamSkillDifference: bestDifference,
    repeatPartnerCount: bestRepeatPartners,
    repeatOpponentCount: 0,
    starvationPenalty: 0,
    skillRange: 0,
  };

  const explanation =
    `First-come, first-out: the ${size} longest-waiting players` +
    (bestDifference === 0
      ? " with evenly matched team skill."
      : `, split to keep the team skill gap to ${bestDifference}.`);

  return {
    ok: true,
    proposal: {
      players: toProposalPlayers(selected, bestAssignment),
      explanation,
      cost: bestCost,
      breakdown,
      skippedPlayerIds: sorted.slice(size).map((c) => c.id),
    },
  };
}

/** Exported for tests: every k-sized group from the pool. */
export { combinations };