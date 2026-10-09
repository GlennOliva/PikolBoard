import { StyleSheet, Text, View } from "react-native";

import { Badge, Card } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatTime } from "@/lib/format";
import type { PublicLiveCourt, PublicMatchLineupRow } from "@/types/database";

export interface LiveCourtCardProps {
  court: PublicLiveCourt;
  lineups: PublicMatchLineupRow[];
}

/** One court on the public board: teams, running score, and status. */
export function LiveCourtCard({ court, lineups }: LiveCourtCardProps) {
  const theme = useTheme();

  const team1 = lineups
    .filter((l) => l.team_number === 1)
    .sort((a, b) => a.slot_number - b.slot_number);
  const team2 = lineups
    .filter((l) => l.team_number === 2)
    .sort((a, b) => a.slot_number - b.slot_number);
  const hasMatch = Boolean(court.match_status && court.match_status !== "cancelled");

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: theme.text }]}>
          {court.court_name ?? `Court ${court.court_number}`}
        </Text>
        <Badge
          label={statusLabel(court)}
          tone={court.match_status === "playing" ? "success" : court.match_status === "staged" ? "warning" : "neutral"}
        />
      </View>

      {hasMatch ? (
        <View style={styles.teams}>
          <Team
            names={team1.map((l) => l.display_name)}
            score={court.team1_score}
            won={court.winning_team === 1}
          />
          <Team
            names={team2.map((l) => l.display_name)}
            score={court.team2_score}
            won={court.winning_team === 2}
          />
          {court.match_started_at && court.match_status === "playing" ? (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              Started {formatTime(court.match_started_at)}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.meta, { color: theme.textMuted }]}>Open</Text>
      )}
    </Card>
  );
}

function Team({
  names,
  score,
  won,
}: {
  names: string[];
  score: number | null;
  won: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.teamRow}>
      <Text
        style={[styles.teamNames, { color: theme.text, fontWeight: won ? "800" : "600" }]}
        numberOfLines={2}
      >
        {names.join(" / ") || "—"}
        {won ? "  ★" : ""}
      </Text>
      <Text style={[styles.score, { color: won ? theme.primary : theme.text }]}>
        {score ?? "-"}
      </Text>
    </View>
  );
}

function statusLabel(court: PublicLiveCourt): string {
  if (court.court_status === "disabled") return "Disabled";
  switch (court.match_status) {
    case "playing":
      return "Playing";
    case "staged":
      return "Warming up";
    case "completed":
      return "Final";
    case "up_next":
      return "Up next";
    case "preparing":
      return "Preparing";
    default:
      return "Open";
  }
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  name: { fontSize: 16, fontWeight: "700" },
  teams: { gap: Spacing.one },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  teamNames: { flex: 1, fontSize: 15 },
  score: { fontSize: 22, fontWeight: "800", minWidth: 34, textAlign: "right" },
  meta: { fontSize: 12 },
});
