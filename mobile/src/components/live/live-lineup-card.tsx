import { StyleSheet, Text, View } from "react-native";

import { Badge, Card } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { PublicLineupSection, PublicLineupPlayer } from "@/types/database";

/** A queued lineup (Preparation or Up Next) on the public board. */
export function LiveLineupCard({ section }: { section: PublicLineupSection }) {
  const theme = useTheme();
  const team1 = section.players
    .filter((p) => p.team_number === 1)
    .sort((a, b) => a.slot_number - b.slot_number);
  const team2 = section.players
    .filter((p) => p.team_number === 2)
    .sort((a, b) => a.slot_number - b.slot_number);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {section.display_name}
        </Text>
        <Badge
          label={section.stage === "up_next" ? "Up next" : "Preparing"}
          tone={section.stage === "up_next" ? "warning" : "neutral"}
        />
      </View>
      <TeamLine players={team1} />
      <TeamLine players={team2} />
    </Card>
  );
}

function TeamLine({ players }: { players: PublicLineupPlayer[] }) {
  const theme = useTheme();
  return (
    <Text style={[styles.team, { color: theme.textSecondary }]} numberOfLines={2}>
      {players.map((p) => p.display_name).join(" / ") || "—"}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  name: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  team: { fontSize: 14 },
});
