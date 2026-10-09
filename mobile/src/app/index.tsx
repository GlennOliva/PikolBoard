import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { Screen } from "@/components/ui/screen";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, isLoading, signOut } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.logoGlyph, { color: theme.primary }]}>PB</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Pickleboard</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Live scores, queues, and matchups for your pickleball club.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Watch a live board</Text>
          <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
            Scan the QR code on the clubhouse screen to follow scores, the queue, and
            who is up next.
          </Text>
          <Button label="Scan Live Board" onPress={() => router.push("/scanner")} size="lg" />
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {user ? "Organizer tools" : "Run a session"}
          </Text>
          <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
            {user
              ? `Signed in as ${user.email ?? "organizer"}.`
              : "Sign in to manage clubs, run matches, and keep score."}
          </Text>
          {isLoading ? null : user ? (
            <View style={styles.actions}>
              <Button
                label="My Clubs"
                onPress={() => router.push("/clubs")}
                size="lg"
              />
              <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
            </View>
          ) : (
            <Button
              label="Organizer Sign In"
              variant="secondary"
              size="lg"
              onPress={() => router.push("/login")}
            />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  hero: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.four },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: { fontSize: 26, fontWeight: "800" },
  title: { fontSize: 32, fontWeight: "800" },
  subtitle: { fontSize: 15, textAlign: "center", maxWidth: 320 },
  card: { gap: Spacing.three },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  cardBody: { fontSize: 15, lineHeight: 21 },
  actions: { gap: Spacing.two },
});
