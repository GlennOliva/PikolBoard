import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { Card } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  formatPointDifferential,
  pointDifferential,
  winPercent,
} from "@/lib/domain/leaderboard/standing-rows";
import { qualifyPodium, type PodiumPlace } from "@/lib/domain/leaderboard/podium";
import type { PublicSessionStanding } from "@/types/database";

/**
 * Shown while nobody has finished a game yet. The section itself always
 * renders during an active session, so this message replaces the table rather
 * than the whole section being hidden.
 */
export const LEADERBOARD_EMPTY_MESSAGE =
  "Leaderboard will appear after the first completed match.";

/**
 * Live leaderboard for the public board.
 *
 * The rows are the RPC's sanitized standings, already ordered by wins then
 * points for. This component only decorates them: rank is the row position and
 * podium medals come from the shared qualification rules, so the public board
 * and the organizer view cannot drift apart. Nothing here filters or re-sorts.
 */
export function LiveLeaderboard({ rows }: { rows: PublicSessionStanding[] }) {
  const theme = useTheme();

  const decorated = qualifyPodium(
    rows.map((row, index) => ({
      ...row,
      playerId: row.player_id,
      gamesPlayed: row.games_played,
      rank: index + 1,
    })),
  );

  return (
    <Card style={styles.card}>
      <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerText, styles.colRank, { color: theme.textMuted }]}>Rank</Text>
        <Text style={[styles.headerText, styles.colName, { color: theme.textMuted }]}>Player</Text>
        <Text style={[styles.headerText, styles.colStat, { color: theme.textMuted }]}>G</Text>
        <Text style={[styles.headerText, styles.colStat, { color: theme.textMuted }]}>W</Text>
        <Text style={[styles.headerText, styles.colStat, { color: theme.textMuted }]}>L</Text>
        <Text style={[styles.headerText, styles.colWide, { color: theme.textMuted }]}>Win %</Text>
        <Text style={[styles.headerText, styles.colWide, { color: theme.textMuted }]}>Diff</Text>
      </View>

      {decorated.map((entry) => {
        const row = entry.row;
        return (
          <View
            key={row.playerId}
            testID={`leaderboard-row-${row.playerId}`}
            style={[styles.row, podiumRowStyle(entry.podium), { borderBottomColor: theme.border }]}
          >
            <View style={[styles.colRank, styles.rankCell]}>
              {entry.medal ? <Text style={styles.medal}>{entry.medal}</Text> : null}
              <Text style={[styles.rankText, { color: theme.textMuted }]}>{entry.rankLabel}</Text>
            </View>

            <View style={styles.colName}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {row.display_name}
              </Text>
              <Text
                style={[
                  styles.qualification,
                  { color: entry.qualified ? theme.success : theme.textMuted },
                ]}
                numberOfLines={1}
              >
                {entry.qualificationLabel}
              </Text>
            </View>

            <Text style={[styles.cell, styles.colStat, { color: theme.text }]}>
              {row.games_played}
            </Text>
            <Text style={[styles.cell, styles.colStat, { color: theme.text }]}>{row.wins}</Text>
            <Text style={[styles.cell, styles.colStat, { color: theme.text }]}>{row.losses}</Text>
            <Text style={[styles.cell, styles.colWide, { color: theme.textSecondary }]}>
              {winPercent(row)}
            </Text>
            <Text style={[styles.cell, styles.colWide, { color: theme.textSecondary }]}>
              {formatPointDifferential(pointDifferential(row))}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

/**
 * Row tint for an official podium place. Paired with the medal glyph and the
 * ordinal so the tier survives greyscale, and kept quiet enough to sit behind
 * the row text in both light and dark mode. The left border is a second,
 * non-colour cue for the same three places.
 */
function podiumRowStyle(podium: PodiumPlace | null): ViewStyle | undefined {
  if (podium === 1) {
    return { backgroundColor: "rgba(245, 197, 24, 0.14)", borderLeftWidth: 3, borderLeftColor: "#D4A017" };
  }
  if (podium === 2) {
    return { backgroundColor: "rgba(148, 163, 184, 0.16)", borderLeftWidth: 3, borderLeftColor: "#94A3B8" };
  }
  if (podium === 3) {
    return { backgroundColor: "rgba(180, 83, 9, 0.14)", borderLeftWidth: 3, borderLeftColor: "#B45309" };
  }
  return undefined;
}

const styles = StyleSheet.create({
  card: { paddingVertical: 0, paddingHorizontal: Spacing.three },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankCell: { flexDirection: "row", alignItems: "center", gap: Spacing.half },
  medal: { fontSize: 14 },
  rankText: { fontSize: 12, fontWeight: "600" },
  colRank: { width: 46 },
  colName: { flex: 1, minWidth: 0 },
  colStat: { width: 20, textAlign: "right" },
  colWide: { width: 46, textAlign: "right" },
  cell: { fontSize: 13, fontVariant: ["tabular-nums"] },
  name: { fontSize: 14, fontWeight: "600" },
  qualification: { fontSize: 11, marginTop: 1 },
});
