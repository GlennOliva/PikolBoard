import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicClub, getPublicClubResults } from "@/lib/db/queries";
import { rankPlayers, type PlayerGameRow } from "@/lib/domain/leaderboard/rank-players";
import { initialsOf } from "@/lib/format";

export const metadata: Metadata = { title: "Leaderboard" };

/**
 * Public all-time club leaderboard.
 *
 * Rows come from public_match_results (one per player per completed match) and
 * the ordering rules live in lib/domain/leaderboard, which is unit tested.
 * Doing it that way keeps one implementation for the public board, the club
 * settings preview, and any future export.
 */
export default function PublicLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/50" />}>
      <Leaderboard params={params} />
    </Suspense>
  );
}

async function Leaderboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();

  const results = await getPublicClubResults(club.id);
  const rows: PlayerGameRow[] = results.map((row) => ({
    playerId: row.player_id,
    displayName: row.display_name,
    skillLevel: row.skill_level,
    won: row.won,
    pointsFor: row.points_for,
    pointsAgainst: row.points_against,
    opponentIds: row.opponent_ids ?? [],
    opponentSkillTotal: row.opponent_skill_total ?? 0,
    partnerIds: row.partner_ids ?? [],
    partnerSkillTotal: row.partner_skill_total ?? 0,
    completedAt: row.completed_at,
  }));

  // minGames=1 drops players who have no completed games from an unfiltered
  // list; rankPlayers already omits anyone with zero rows.
  const ranked = rankPlayers(rows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/c/${club.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {club.name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Trophy className="size-6 text-primary" aria-hidden />
          All-time leaderboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ranked by wins, then exact win percentage, strength of schedule,
          point differential, and name.
        </p>
      </div>

      {ranked.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No published results yet. Organizers publish final results when a
            session ends.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">
                All-time results for {club.name}
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-2">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-2">
                    Player
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right">
                    Record
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right">
                    Win %
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right">
                    Diff
                  </th>
                  <th scope="col" className="py-2 text-right">
                    SoS
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((player) => (
                  <tr key={player.playerId} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                      {player.rank}
                    </td>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold"
                        >
                          {initialsOf(player.displayName)}
                        </span>
                        {player.displayName}
                        {player.winStreak >= 3 ? (
                          <Badge variant="secondary">
                            {player.winStreak} in a row
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {player.wins}–{player.losses}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {(player.winPercentage * 100).toFixed(0)}%
                    </td>
                    <td
                      className={
                        "py-2 pr-2 text-right tabular-nums " +
                        (player.pointDifferential > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : player.pointDifferential < 0
                            ? "text-destructive"
                            : "")
                      }
                    >
                      {player.pointDifferential > 0 ? "+" : ""}
                      {player.pointDifferential}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {(player.strengthOfSchedule * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}