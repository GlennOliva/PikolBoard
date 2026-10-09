import { proposeBalanced } from "./balanced";
import { proposeFifo } from "./fifo";
import { proposeSkillSeparated } from "./skill-separated";
import { getEligiblePlayers } from "./shared";
import type {
  MatchingRules,
  ProposalResult,
  QueueCandidate,
  RecentMatch,
} from "./types";

/**
 * Single entry point used by the server action. Picks the engine for the
 * session's configured mode so the UI never branches on mode itself.
 */
export function proposeMatch(
  candidates: QueueCandidate[],
  rules: MatchingRules,
  recentMatches: RecentMatch[] = [],
): ProposalResult {
  const eligible = getEligiblePlayers(candidates, rules);

  switch (rules.mode) {
    case "fifo":
      return proposeFifo(eligible, rules, recentMatches);
    case "skill_separated":
      return proposeSkillSeparated(eligible, rules, recentMatches);
    case "balanced":
    default:
      return proposeBalanced(eligible, rules, recentMatches);
  }
}

export { proposeFifo, proposeBalanced, proposeSkillSeparated };
export { getEligiblePlayers, isEligible, playersPerMatch, sortByTieBreakers } from "./shared";
export * from "./types";
