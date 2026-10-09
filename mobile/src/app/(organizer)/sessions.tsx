import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, EmptyState, ErrorNotice, Field, LoadingState } from "@/components/ui";
import { Screen, ScreenHeader, goBack } from "@/components/ui/screen";
import { Radius, Spacing } from "@/constants/theme";
import { useAsyncData } from "@/hooks/use-async-data";
import { useTheme } from "@/hooks/use-theme";
import { formatSessionWindow } from "@/lib/format";
import { createSession, messageFromError } from "@/lib/mutations";
import { getClubSessions } from "@/lib/queries";
import type {
  MatchingMode,
  Session,
  SessionFormat,
  SessionStatus,
  TargetScore,
  WinBy,
} from "@/types/database";

export default function SessionsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ clubId: string; clubName?: string }>();
  const clubId = params.clubId;
  const clubName = params.clubName ?? "Club";

  const sessions = useAsyncData(() => getClubSessions(clubId), [clubId]);
  const [showForm, setShowForm] = useState(false);

  const renderSession = useCallback(
    ({ item }: { item: Session }) => (
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/session/[sessionId]",
            params: { sessionId: item.id, clubName },
          })
        }
      >
        {({ pressed }) => (
          <Card style={[styles.session, pressed && styles.pressed]}>
            <View style={styles.sessionHeader}>
              <Text style={[styles.sessionName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Badge label={statusLabel(item.status)} tone={statusTone(item.status)} />
            </View>
            <Text style={[styles.sessionMeta, { color: theme.textSecondary }]}>
              {[modeLabel(item.format, item.matching_mode), `${item.court_count} courts`].join(" · ")}
            </Text>
            <Text style={[styles.sessionMeta, { color: theme.textMuted }]}>
              {formatSessionWindow(item)}
            </Text>
          </Card>
        )}
      </Pressable>
    ),
    [clubName, theme.text, theme.textMuted, theme.textSecondary],
  );

  return (
    <Screen>
      <ScreenHeader
        title={clubName}
        subtitle="Sessions"
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
        data={sessions.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        style={styles.flex}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={sessions.loading} onRefresh={() => void sessions.reload()} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {sessions.error ? <ErrorNotice message={sessions.error} /> : null}
            {showForm ? (
              <CreateSessionForm
                clubId={clubId}
                onCreated={(id) => {
                  setShowForm(false);
                  void sessions.reload();
                  router.push({
                    pathname: "/session/[sessionId]",
                    params: { sessionId: id, clubName },
                  });
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          sessions.loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              title="No sessions yet"
              message="Create a session with the format and courts you plan to run."
              actionLabel={showForm ? undefined : "New session"}
              onAction={() => setShowForm(true)}
            />
          )
        }
      />
    </Screen>
  );
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case "active":
      return "Live";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Draft";
  }
}

function statusTone(status: SessionStatus): "success" | "neutral" | "danger" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "completed":
      return "info";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function modeLabel(format: SessionFormat, mode: MatchingMode): string {
  const formatLabel = format === "singles" ? "Singles" : "Doubles";
  const modeLabelText =
    mode === "fifo" ? "FIFO" : mode === "balanced" ? "Balanced" : "Skill separated";
  return `${formatLabel} · ${modeLabelText}`;
}

function CreateSessionForm({
  clubId,
  onCreated,
}: {
  clubId: string;
  onCreated: (id: string) => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState("Open Play");
  const [format, setFormat] = useState<SessionFormat>("doubles");
  const [mode, setMode] = useState<MatchingMode>("balanced");
  const [targetScore, setTargetScore] = useState<TargetScore>(11);
  const [winBy, setWinBy] = useState<WinBy>(1);
  const [courtCount, setCourtCount] = useState("4");
  const [maxGames, setMaxGames] = useState("");
  const [starvation, setStarvation] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const courts = Number.parseInt(courtCount, 10);
    const starvationMinutes = Number.parseInt(starvation, 10);
    const maxGamesParsed = maxGames.trim() ? Number.parseInt(maxGames, 10) : null;

    if (name.trim().length < 2) return setError("Name the session.");
    if (!Number.isFinite(courts) || courts < 1) return setError("Enter at least one court.");
    if (!Number.isFinite(starvationMinutes) || starvationMinutes < 0) {
      return setError("Starvation threshold must be zero or more minutes.");
    }

    setBusy(true);
    try {
      const id = await createSession({
        clubId,
        name: name.trim(),
        format,
        matchingMode: mode,
        targetScore,
        winBy,
        courtCount: courts,
        maxGames: maxGamesParsed,
        starvationMinutes,
      });
      onCreated(id);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.form}>
      <Text style={[styles.formTitle, { color: theme.text }]}>New session</Text>
      {error ? <ErrorNotice message={error} /> : null}
      <Field label="Name" value={name} onChangeText={setName} />

      <ChoiceRow
        label="Format"
        value={format}
        options={[
          { value: "doubles", label: "Doubles" },
          { value: "singles", label: "Singles" },
        ]}
        onChange={(v) => setFormat(v as SessionFormat)}
      />
      <ChoiceRow
        label="Matchmaking"
        value={mode}
        options={[
          { value: "fifo", label: "FIFO" },
          { value: "balanced", label: "Balanced" },
          { value: "skill_separated", label: "Skill" },
        ]}
        onChange={(v) => setMode(v as MatchingMode)}
      />
      <ChoiceRow
        label="Target score"
        value={String(targetScore)}
        options={[
          { value: "11", label: "11" },
          { value: "15", label: "15" },
          { value: "21", label: "21" },
        ]}
        onChange={(v) => setTargetScore(Number(v) as TargetScore)}
      />
      <ChoiceRow
        label="Win by"
        value={String(winBy)}
        options={[
          { value: "1", label: "1" },
          { value: "2", label: "2" },
        ]}
        onChange={(v) => setWinBy(Number(v) as WinBy)}
      />

      <Field
        label="Courts"
        value={courtCount}
        onChangeText={setCourtCount}
        keyboardType="number-pad"
      />
      <Field
        label="Max games per player (optional)"
        value={maxGames}
        onChangeText={setMaxGames}
        keyboardType="number-pad"
        placeholder="No limit"
      />
      <Field
        label="Starvation threshold (minutes)"
        value={starvation}
        onChangeText={setStarvation}
        keyboardType="number-pad"
      />
      <Button label="Create session" onPress={() => void submit()} loading={busy} />
    </Card>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.choiceWrap}>
      <Text style={[styles.choiceLabel, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? theme.primary : theme.backgroundSelected,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? theme.primaryText : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three, flexGrow: 1 },
  header: { gap: Spacing.three },
  session: { gap: Spacing.one },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  sessionName: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
  sessionMeta: { fontSize: 13 },
  pressed: { opacity: 0.7 },
  form: { gap: Spacing.three },
  formTitle: { fontSize: 16, fontWeight: "700" },
  choiceWrap: { gap: Spacing.one },
  choiceLabel: { fontSize: 13, fontWeight: "600" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  choice: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
