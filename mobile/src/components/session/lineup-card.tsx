import { StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { groupTeams, teamLabel } from "@/lib/lineup";
import type { MatchWithPlayers } from "@/types/session";

export interface LineupCardProps {
  match: MatchWithPlayers;
  onEdit?: () => void;
  onCancel?: () => void;
  onPromote?: () => void;
  onDemote?: () => void;
  onAssign?: () => void;
  onOpen?: () => void;
  busy?: boolean;
}

/**
 * One lineup in the Preparation or Up Next pipeline. The stage decides which
 * single step forward is offered (promote, assign, or nothing) plus the
 * non-destructive escape hatches (edit, cancel) shared by both stages.
 */
export function LineupCard({
  match,
  onEdit,
  onCancel,
  onPromote,
  onDemote,
  onAssign,
  onOpen,
  busy,
}: LineupCardProps) {
  const theme = useTheme();
  const { team1, team2 } = groupTeams(match.players);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {match.display_name ?? `Match ${match.match_number}`}
        </Text>
        <Badge
          label={match.status === "preparing" ? "Preparing" : "Up Next"}
          tone={match.status === "preparing" ? "neutral" : "warning"}
        />
      </View>

      <View style={styles.teamRow}>
        <View style={styles.team}>
          <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={2}>
            {teamLabel(team1)}
          </Text>
        </View>
        <Text style={[styles.vs, { color: theme.textMuted }]}>vs</Text>
        <View style={styles.team}>
          <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={2}>
            {teamLabel(team2)}
          </Text>
        </View>
      </View>

      {match.explanation ? (
        <Text style={[styles.explanation, { color: theme.textSecondary }]}>
          {match.explanation}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {onEdit ? <Button label="Edit" variant="secondary" onPress={onEdit} disabled={busy} /> : null}
        {match.status === "preparing" && onPromote ? (
          <Button label="Up Next" onPress={onPromote} disabled={busy} />
        ) : null}
        {match.status === "up_next" && onDemote ? (
          <Button label="Back" variant="secondary" onPress={onDemote} disabled={busy} />
        ) : null}
        {match.status === "up_next" && onAssign ? (
          <Button label="Assign court" onPress={onAssign} disabled={busy} />
        ) : null}
        {onOpen ? <Button label="Court" variant="ghost" onPress={onOpen} disabled={busy} /> : null}
        {onCancel ? (
          <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={busy} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  name: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  team: { flex: 1 },
  teamName: { fontSize: 15, fontWeight: "600" },
  vs: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  explanation: { fontSize: 12, fontStyle: "italic" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
});
