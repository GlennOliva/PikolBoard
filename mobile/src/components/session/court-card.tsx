import { StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { groupTeams, teamLabel } from "@/lib/lineup";
import type { MatchWithPlayers, SessionBundleCourt } from "@/types/session";

export interface CourtCardProps {
  court: SessionBundleCourt;
  /** Offer "Assign next" when an Up Next lineup is waiting and this court is free. */
  canAssign?: boolean;
  onAssign?: () => void;
  onOpenMatch?: (match: MatchWithPlayers) => void;
  onStart?: (match: MatchWithPlayers) => void;
  onCancel?: (match: MatchWithPlayers) => void;
  busy?: boolean;
}

export function CourtCard({
  court,
  canAssign,
  onAssign,
  onOpenMatch,
  onStart,
  onCancel,
  busy,
}: CourtCardProps) {
  const theme = useTheme();
  const match = court.match;
  const { team1, team2 } = match ? groupTeams(match.players) : { team1: [], team2: [] };
  const accent = courtAccent(court, theme);

  return (
    <Card style={[styles.card, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: theme.text }]}>
          {court.name ?? `Court ${court.court_number}`}
        </Text>
        <Badge label={badgeLabel(court, match)} tone={badgeTone(court, match)} />
      </View>

      {match ? (
        <>
          <View style={styles.scoreRow}>
            <Text style={[styles.team, { color: theme.text }]} numberOfLines={2}>
              {teamLabel(team1)}
            </Text>
            <Text style={[styles.score, { color: theme.text }]}>
              {match.team1_score ?? "-"}
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.team, { color: theme.text }]} numberOfLines={2}>
              {teamLabel(team2)}
            </Text>
            <Text style={[styles.score, { color: theme.text }]}>
              {match.team2_score ?? "-"}
            </Text>
          </View>

          <View style={styles.actions}>
            {match.status === "staged" && onStart ? (
              <Button label="Start match" onPress={() => onStart(match)} disabled={busy} />
            ) : null}
            {onOpenMatch ? (
              <Button
                label={match.status === "playing" ? "Score" : "Open"}
                variant={match.status === "staged" ? "secondary" : "primary"}
                onPress={() => onOpenMatch(match)}
                disabled={busy}
              />
            ) : null}
            {onCancel ? (
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => onCancel(match)}
                disabled={busy}
              />
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {court.status === "disabled" ? "Disabled" : "No match assigned"}
          </Text>
          {canAssign && onAssign ? (
            <Button label="Assign next" variant="secondary" onPress={onAssign} disabled={busy} />
          ) : null}
        </View>
      )}
    </Card>
  );
}

function courtAccent(
  court: SessionBundleCourt,
  theme: ReturnType<typeof useTheme>,
): string {
  if (court.status === "disabled") return theme.courtDisabled;
  if (court.status === "playing") return theme.courtPlaying;
  if (court.status === "staged") return theme.courtStaged;
  return theme.courtAvailable;
}

function badgeLabel(court: SessionBundleCourt, match: MatchWithPlayers | null): string {
  if (court.status === "disabled") return "Disabled";
  if (match?.status === "playing") return "Playing";
  if (match?.status === "staged") return "Ready";
  return "Open";
}

function badgeTone(
  court: SessionBundleCourt,
  match: MatchWithPlayers | null,
): "success" | "warning" | "neutral" | "danger" {
  if (court.status === "disabled") return "danger";
  if (match?.status === "playing") return "success";
  if (match?.status === "staged") return "warning";
  return "neutral";
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
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  team: { flex: 1, fontSize: 15, fontWeight: "600" },
  score: { fontSize: 22, fontWeight: "800", minWidth: 34, textAlign: "right" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, marginTop: Spacing.one },
  emptyWrap: { gap: Spacing.two },
  empty: { fontSize: 14 },
});
