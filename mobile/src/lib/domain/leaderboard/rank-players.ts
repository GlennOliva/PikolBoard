/**
 * Leaderboard ranking.
 *
 * Ranking order:
 *   1. wins descending
 *   2. exact win percentage descending
 *   3. strength of schedule descending
 *   4. point differential descending
 *   5. player name ascending
 *
 * Players identical through point differential share the same competition rank.
 */

export interface PlayerGameRow {
  playerId: string;
  displayName: string;
  skillLevel: number;
  won: boolean;
  pointsFor: number;
  pointsAgainst: number;
  opponentIds: string[];
  opponentSkillTotal: number;
  partnerIds: string[];
  partnerSkillTotal: number;
  completedAt: string;
}

export interface RankedPlayer {
  rank: number;
  playerId: string;
  displayName: string;
  skillLevel: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  winPercentage: number;
  winStreak: number;
  averagePartnerSkill: number | null;
  strengthOfSchedule: number;
}

export interface RankOptions {
  /** Drop players below this many games. Default 0 (show everyone). */
  minGames?: number;
}

export function computeWinPercentages(
  rows: PlayerGameRow[],
): Record<string, number> {
  const totals = new Map<string, { wins: number; games: number }>();

  for (const row of rows) {
    const entry = totals.get(row.playerId) ?? { wins: 0, games: 0 };
    entry.games += 1;
    if (row.won) entry.wins += 1;
    totals.set(row.playerId, entry);
  }

  const percentages: Record<string, number> = {};
  for (const [playerId, { wins, games }] of totals) {
    percentages[playerId] = games > 0 ? wins / games : 0;
  }
  return percentages;
}

function fraction(wins: number, games: number): number {
  return games === 0 ? 0 : wins / games;
}

export function rankPlayers(
  rows: PlayerGameRow[],
  options: RankOptions = {},
): RankedPlayer[] {
  const minGames = options.minGames ?? 0;
  const winPercentages = computeWinPercentages(rows);

  const byPlayer = new Map<string, PlayerGameRow[]>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row);
    byPlayer.set(row.playerId, list);
  }

  const summaries = [...byPlayer.entries()].map(([playerId, games]) => {
    games.sort((a, b) => {
      const at = new Date(a.completedAt).getTime();
      const bt = new Date(b.completedAt).getTime();
      if (at !== bt) return at - bt;
      return 0;
    });

    const wins = games.filter((g) => g.won).length;
    const pointsFor = games.reduce((sum, g) => sum + g.pointsFor, 0);
    const pointsAgainst = games.reduce((sum, g) => sum + g.pointsAgainst, 0);

    let opponentPctSum = 0;
    for (const game of games) {
      if (game.opponentIds.length === 0) continue;
      const perGame =
        game.opponentIds.reduce(
          (sum, id) => sum + (winPercentages[id] ?? 0),
          0,
        ) / game.opponentIds.length;
      opponentPctSum += perGame;
    }
    const strengthOfSchedule =
      games.length > 0 ? opponentPctSum / games.length : 0;

    let partnerSkillSum = 0;
    let partnerCount = 0;
    for (const game of games) {
      if (game.partnerIds.length === 0) continue;
      const avg = game.partnerSkillTotal / game.partnerIds.length;
      partnerSkillSum += avg;
      partnerCount += game.partnerIds.length;
    }
    const averagePartnerSkill =
      partnerCount > 0 ? partnerSkillSum / games.filter((g) => g.partnerIds.length > 0).length : null;

    let winStreak = 0;
    for (let i = games.length - 1; i >= 0; i -= 1) {
      const won = games[i].won;
      if (winStreak === 0) {
        winStreak = won ? 1 : -1;
        continue;
      }
      if (winStreak > 0 && won) winStreak += 1;
      else if (winStreak < 0 && !won) winStreak -= 1;
      else break;
    }

    return {
      playerId,
      displayName: games[0].displayName,
      skillLevel: games[0].skillLevel,
      gamesPlayed: games.length,
      wins,
      losses: games.length - wins,
      pointsFor,
      pointsAgainst,
      pointDifferential: pointsFor - pointsAgainst,
      winPercentage: fraction(wins, games.length),
      winStreak,
      averagePartnerSkill,
      strengthOfSchedule,
    };
  });

  const visible = summaries.filter((s) => s.gamesPlayed >= minGames);

  visible.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.winPercentage !== b.winPercentage) {
      return b.winPercentage - a.winPercentage;
    }
    if (a.strengthOfSchedule !== b.strengthOfSchedule) {
      return b.strengthOfSchedule - a.strengthOfSchedule;
    }
    if (a.pointDifferential !== b.pointDifferential) {
      return b.pointDifferential - a.pointDifferential;
    }
    return a.displayName.localeCompare(b.displayName, "en");
  });

  let lastRanked: RankedPlayer | null = null;
  let currentRank = 0;

  return visible.map((player, index) => {
    const sharesRankWithPrevious =
      lastRanked !== null &&
      lastRanked.wins === player.wins &&
      lastRanked.winPercentage === player.winPercentage &&
      lastRanked.strengthOfSchedule === player.strengthOfSchedule &&
      lastRanked.pointDifferential === player.pointDifferential;

    if (!sharesRankWithPrevious) {
      currentRank = index + 1;
    }

    const ranked: RankedPlayer = { ...player, rank: currentRank };
    lastRanked = ranked;
    return ranked;
  });
}

/** Percent string for display only. Never used for comparisons. */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
