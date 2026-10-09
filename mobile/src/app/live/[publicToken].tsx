import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar, Badge, Card, EmptyState, LoadingState, Section } from "@/components/ui";
import { Screen, ScreenHeader, goBack } from "@/components/ui/screen";
import { LiveCourtCard } from "@/components/live/live-court-card";
import { LiveLineupCard } from "@/components/live/live-lineup-card";
import { LiveLeaderboard, LEADERBOARD_EMPTY_MESSAGE } from "@/components/live/live-leaderboard";
import { Spacing } from "@/constants/theme";
import { useAsyncData } from "@/hooks/use-async-data";
import { useTheme } from "@/hooks/use-theme";
import { getPlayerLiveBoard } from "@/lib/queries";
import { attendanceLabel } from "@/lib/domain/live-board/wait-time";
import { formatSessionWindow } from "@/lib/format";
import type { PublicMatchLineupRow } from "@/types/database";

const POLL_MS = 10_000;

export default function LiveBoardScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ publicToken: string }>();
  const token = params.publicToken;

  const board = useAsyncData(
    () => getPlayerLiveBoard(token),
    [token],
    { pollMs: POLL_MS },
  );

  const payload = board.data;

  const lineupsByCourt = useMemo(() => {
    const map = new Map<number, PublicMatchLineupRow[]>();
    for (const row of payload?.lineups ?? []) {
      const list = map.get(row.court_number) ?? [];
      list.push(row);
      map.set(row.court_number, list);
    }
    return map;
  }, [payload?.lineups]);

  const queue = useMemo(
    () =>
      (payload?.presence ?? [])
        .filter((p) => p.attendance_status === "waiting" && p.queue_position != null)
        .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0)),
    [payload?.presence],
  );

  const offCourt = useMemo(
    () =>
      (payload?.presence ?? []).filter(
        (p) => p.attendance_status === "break" || p.attendance_status === "checked_out",
      ),
    [payload?.presence],
  );

  if (board.loading && !payload) {
    return (
      <Screen>
        <ScreenHeader title="Live Board" onBack={goBack} />
        <LoadingState label="Loading the live board…" />
      </Screen>
    );
  }

  if (!payload) {
    return (
      <Screen>
        <ScreenHeader title="Live Board" onBack={goBack} />
        <EmptyState
          title="Board unavailable"
          message={board.error ?? "This Live Board has ended or the link is no longer valid."}
          actionLabel="Retry"
          onAction={() => void board.reload()}
        />
      </Screen>
    );
  }

  const { session } = payload;

  return (
    <Screen>
      <ScreenHeader
        title={session.club_name}
        subtitle={session.name}
        onBack={goBack}
        right={
          <Badge
            label={session.status === "active" ? "Live" : session.status}
            tone={session.status === "active" ? "success" : "neutral"}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={board.loading} onRefresh={() => void board.reload()} />
        }
      >
        <Card style={styles.summary}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>
            {[session.format, `${session.court_count} courts`, `to ${session.target_score}`].join(
              " · ",
            )}
          </Text>
          <Text style={[styles.summaryMeta, { color: theme.textSecondary }]}>
            {formatSessionWindow(session)}
          </Text>
          {session.avg_match_minutes ? (
            <Text style={[styles.summaryMeta, { color: theme.textMuted }]}>
              Avg match {Math.round(session.avg_match_minutes)} min
              {session.completed_match_count
                ? ` · ${session.completed_match_count} played`
                : ""}
            </Text>
          ) : null}
        </Card>

        {payload.courts.length > 0 ? (
          <Section title="Courts">
            {payload.courts.map((court) => (
              <LiveCourtCard
                key={`${court.court_number}`}
                court={court}
                lineups={compactLineups(lineupsByCourt.get(court.court_number))}
              />
            ))}
          </Section>
        ) : null}

        {payload.up_next.length > 0 ? (
          <Section title="Up next">
            {payload.up_next.map((section) => (
              <LiveLineupCard key={section.match_id} section={section} />
            ))}
          </Section>
        ) : null}

        {payload.preparation.length > 0 ? (
          <Section title="Getting ready">
            {payload.preparation.map((section) => (
              <LiveLineupCard key={section.match_id} section={section} />
            ))}
          </Section>
        ) : null}

        <Section title={`Queue (${queue.length})`}>
          {queue.length === 0 ? (
            <Text style={[styles.muted, { color: theme.textMuted }]}>No one waiting.</Text>
          ) : (
            <Card style={styles.queueCard}>
              {queue.map((row) => (
                <View key={row.presence_id} style={[styles.queueRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.queuePos, { color: theme.textMuted }]}>
                    {row.queue_position}
                  </Text>
                  <Avatar name={row.display_name} size={32} />
                  <Text style={[styles.queueName, { color: theme.text }]} numberOfLines={1}>
                    {row.display_name}
                  </Text>
                  <Text style={[styles.queueMeta, { color: theme.textMuted }]}>
                    {row.games_played} played
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </Section>

        {offCourt.length > 0 ? (
          <Section title="Off court">
            <Card style={styles.queueCard}>
              {offCourt.map((row) => (
                <View key={row.presence_id} style={[styles.queueRow, { borderBottomColor: theme.border }]}>
                  <Badge label={attendanceLabel(row.attendance_status)} tone="neutral" />
                  <Text style={[styles.queueName, { color: theme.text }]} numberOfLines={1}>
                    {row.display_name}
                  </Text>
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        <Section title="Live Leaderboard">
          {payload.standings.length > 0 ? (
            <LiveLeaderboard rows={payload.standings} />
          ) : (
            <Text style={[styles.muted, { color: theme.textMuted }]}>
              {LEADERBOARD_EMPTY_MESSAGE}
            </Text>
          )}
        </Section>

        {board.error ? (
          <Text style={[styles.muted, { color: theme.textMuted }]}>
            Showing the last update; reconnecting…
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function compactLineups(
  rows: PublicMatchLineupRow[] | undefined,
): PublicMatchLineupRow[] {
  return rows ?? [];
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  summary: { gap: Spacing.one },
  summaryTitle: { fontSize: 16, fontWeight: "700" },
  summaryMeta: { fontSize: 13 },
  muted: { fontSize: 14 },
  queueCard: { paddingVertical: 0 },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  queuePos: { width: 22, fontSize: 13, fontWeight: "700" },
  queueName: { flex: 1, fontSize: 15, fontWeight: "600" },
  queueMeta: { fontSize: 13 },
});
