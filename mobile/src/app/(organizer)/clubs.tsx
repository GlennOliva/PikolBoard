import { useCallback, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Badge, Button, Card, EmptyState, ErrorNotice, Field, LoadingState } from "@/components/ui";
import { Screen, ScreenHeader, goBack } from "@/components/ui/screen";
import { Spacing } from "@/constants/theme";
import { useAsyncData } from "@/hooks/use-async-data";
import { useTheme } from "@/hooks/use-theme";
import { messageFromError, createClub } from "@/lib/mutations";
import { getMyClubs } from "@/lib/queries";
import { roleLabel } from "@/lib/permissions";
import type { ClubWithMembership } from "@/types/database";

export default function ClubsScreen() {
  const theme = useTheme();
  const clubs = useAsyncData(getMyClubs, []);
  const [showForm, setShowForm] = useState(false);

  const renderClub = useCallback(
    ({ item }: { item: ClubWithMembership }) => (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/sessions",
            params: { clubId: item.id, clubName: item.name },
          })
        }
      >
        {({ pressed }) => (
          <Card style={[styles.club, pressed && styles.pressed]}>
            <View style={styles.clubHeader}>
              <Text style={[styles.clubName, { color: theme.text }]}>{item.name}</Text>
              <Badge
                label={roleLabel(item.viewer_role)}
                tone={item.viewer_role === "player" ? "neutral" : "primary"}
              />
            </View>
            <Text style={[styles.clubMeta, { color: theme.textSecondary }]}>
              {[item.location, `/${item.slug}`].filter(Boolean).join(" · ")}
            </Text>
          </Card>
        )}
      </Pressable>
    ),
    [theme.text, theme.textSecondary],
  );

  return (
    <Screen>
      <ScreenHeader
        title="My Clubs"
        onBack={goBack}
        right={
          <Button
            label={showForm ? "Close" : "New"}
            variant="ghost"
            onPress={() => setShowForm((v) => !v)}
          />
        }
      />
      <FlatList
        data={clubs.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderClub}
        style={styles.flex}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={clubs.loading} onRefresh={() => void clubs.reload()} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {clubs.error ? <ErrorNotice message={clubs.error} /> : null}
            {showForm ? (
              <CreateClubForm
                onCreated={(id, name) => {
                  setShowForm(false);
                  void clubs.reload();
                  router.push({
                    pathname: "/sessions",
                    params: { clubId: id, clubName: name },
                  });
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          clubs.loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              title="No clubs yet"
              message="Create a club to start running sessions, or ask an organizer to add you."
              actionLabel={showForm ? undefined : "Create a club"}
              onAction={() => setShowForm(true)}
            />
          )
        }
      />
    </Screen>
  );
}

function CreateClubForm({ onCreated }: { onCreated: (id: string, name: string) => void }) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function submit() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give the club a name.");
      return;
    }
    setBusy(true);
    try {
      const id = await createClub({
        name: trimmed,
        slug: slugify(trimmed),
        location: location.trim() || null,
        timezone: "UTC",
      });
      onCreated(id, trimmed);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.form}>
      <Text style={[styles.formTitle, { color: theme.text }]}>New club</Text>
      {error ? <ErrorNotice message={error} /> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="Downtown Pickle" />
      <Field
        label="Location (optional)"
        value={location}
        onChangeText={setLocation}
        placeholder="City, State"
      />
      <Button label="Create club" onPress={() => void submit()} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1 },
  header: { gap: Spacing.three },
  club: { gap: Spacing.one },
  clubHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  clubName: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
  clubMeta: { fontSize: 13 },
  pressed: { opacity: 0.7 },
  form: { gap: Spacing.three },
  formTitle: { fontSize: 16, fontWeight: "700" },
});
