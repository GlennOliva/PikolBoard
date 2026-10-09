import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Share,
  Text,
  View,
} from "react-native";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  LoadingState,
  Section,
} from "@/components/ui";
import { Screen, ScreenHeader, goBack } from "@/components/ui/screen";
import { AttendanceRow } from "@/components/session/attendance-row";
import { CourtCard } from "@/components/session/court-card";
import { LineupCard } from "@/components/session/lineup-card";
import {
  AddPlayersModal,
  AssignCourtModal,
  EditLineupModal,
} from "@/components/session/modals";
import { Spacing } from "@/constants/theme";
import { useAsyncData } from "@/hooks/use-async-data";
import { useTheme } from "@/hooks/use-theme";
import {
  checkInPlayer,
  createPreparationLineup,
  messageFromError,
} from "@/lib/mutations";
import * as api from "@/lib/mutations";
import {
  getRoster,
  getRecentMatches,
  getSessionBundle,
  getSessionStandings,
} from "@/lib/queries";
import { resolveLiveBoardUrl, canShowPlayerLiveQr } from "@/lib/domain/live-board/live-board-url";
import { proposeMatch, type QueueCandidate } from "@/lib/domain/matching";
import { estimatedWaitMinutes } from "@/lib/domain/live-board/wait-time";
import { availableForQueue } from "@/lib/lineup";
import type { MatchWithPlayers } from "@/types/session";
import type { SessionPlayer } from "@/types/database";

export default function SessionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ sessionId: string; clubName?: string }>();
  const sessionId = params.sessionId;
  const clubName = params.clubName ?? "Session";

  const bundle = useAsyncData(() => getSessionBundle(sessionId), [sessionId]);
  const standings = useAsyncData(() => getSessionStandings(sessionId), [sessionId]);
  const clubId = bundle.data?.session.club_id;
  const clubRoster = useAsyncData(
    () => (clubId ? getRoster(clubId) : Promise.resolve([])),
    [clubId],
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal targets.
  const [assignTarget, setAssignTarget] = useState<MatchWithPlayers | null>(null);
  const [editTarget, setEditTarget] = useState<MatchWithPlayers | null>(null);
  const [showAddPlayers, setShowAddPlayers] = useState(false);

  const reloadAll = useCallback(async () => {
    await Promise.all([bundle.reload(), standings.reload()]);
  }, [bundle, standings]);

  useEffect(() => {
    if (!sessionId) return;
    let unsubscribe: (() => void) | undefined;
    void import("@/lib/realtime").then(({ subscribeToSession }) => {
      unsubscribe = subscribeToSession(sessionId, () => void reloadAll());
    });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, successNotice?: string) => {
      setBusy(true);
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        await reloadAll();
        if (successNotice) setNotice(successNotice);
      } catch (err) {
        setActionError(messageFromError(err));
      } finally {
        setBusy(false);
      }
    },
    [reloadAll],
  );

  const session = bundle.data?.session ?? null;
  const courts = bundle.data?.courts ?? [];
  const rosterData = bundle.data?.roster;
  const matchesData = bundle.data?.matches;
  const roster = useMemo(() => rosterData ?? [], [rosterData]);
  const matches = useMemo(() => matchesData ?? [], [matchesData]);

  const preparing = useMemo(
    () => matches.filter((m) => m.status === "preparing"),
    [matches],
  );
  const upNext = useMemo(() => matches.filter((m) => m.status === "up_next"), [matches]);
  const queued = useMemo(() => availableForQueue(roster), [roster]);
  const nextUpNext = upNext[0] ?? null;

  const sessionPlayerIds = useMemo(
    () => new Set(roster.map((p) => p.player_id)),
    [roster],
  );

  const shareUrl = useMemo(() => {
    if (!session?.public_live_token) return null;
    return resolveLiveBoardUrl({
      appUrl: process.env.EXPO_PUBLIC_APP_URL,
      publicToken: session.public_live_token,
    });
  }, [session?.public_live_token]);

  const canShare = session
    ? canShowPlayerLiveQr({
        status: session.status,
        enabled: session.player_live_enabled,
        publicToken: session.public_live_token,
      })
    : false;

  async function suggestLineup() {
    if (!session) return;
    await run(async () => {
      const recent = await getRecentMatches(sessionId);
      const candidates: QueueCandidate[] = roster.map((row) => ({
        id: row.player_id,
        displayName: row.display_name,
        skillLevel: row.skill_level,
        attendanceStatus: row.attendance_status,
        queuePosition: row.queue_position,
        gamesPlayed: row.games_played,
        timesSkipped: row.times_skipped,
        lastPlayedAt: row.last_played_at,
        lastEnqueuedAt: row.last_enqueued_at,
      }));

      const result = proposeMatch(candidates, {
        format: session.format,
        mode: session.matching_mode,
        maxGames: session.max_games,
        starvationThresholdMinutes: session.starvation_threshold_minutes,
        now: new Date(),
      }, recent);

      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      await createPreparationLineup({
        sessionId,
        playerIds: result.proposal.players.map((p) => p.playerId),
        teamNumbers: result.proposal.players.map((p) => p.teamNumber),
        slotNumbers: result.proposal.players.map((p) => p.slotNumber),
        explanation: result.proposal.explanation,
        matchingMode: session.matching_mode,
      });
    });
  }

  function confirmEnd(force: boolean) {
    Alert.alert(
      force ? "End session anyway?" : "End session?",
      force
        ? "Staged and in-play matches will be cancelled."
        : "This closes the session and publishes final results.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: () => void run(() => api.endSession(sessionId, force)),
        },
      ],
    );
  }

  async function share() {
    if (!shareUrl) return;
    try {
      await Share.share({ message: shareUrl.url });
    } catch {
      // Sharing dismissals surface as errors on some platforms; ignore them.
    }
  }

  if (bundle.loading && !bundle.data) {
    return (
      <Screen>
        <ScreenHeader title={clubName} subtitle="Session" onBack={goBack} />
        <LoadingState />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ScreenHeader title={clubName} subtitle="Session" onBack={goBack} />
        <EmptyState
          title="Session not found"
          message={bundle.error ?? "It may have been deleted or you do not have access."}
        />
      </Screen>
    );
  }

  const isDraft = session.status === "draft";
  const isActive = session.status === "active";

  return (
    <Screen>
      <ScreenHeader
        title={session.name}
        subtitle={clubName}
        onBack={goBack}
        right={
          canShare ? <Button label="Share" variant="ghost" onPress={() => void share()} /> : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={bundle.loading} onRefresh={() => void reloadAll()} />
        }
      >
        {actionError ? <ErrorNotice message={actionError} /> : null}
        {notice ? <Text style={[styles.notice, { color: theme.success }]}>{notice}</Text> : null}
        {bundle.error ? <ErrorNotice message={bundle.error} /> : null}

        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Badge
              label={session.status === "active" ? "Live" : session.status}
              tone={isActive ? "success" : isDraft ? "info" : "neutral"}
            />
            <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>
              {session.format} · {session.court_count} courts · to {session.target_score}
            </Text>
          </View>
          {canShare && shareUrl ? (
            <Text style={[styles.statusMeta, { color: theme.textMuted }]}>
              {shareUrl.url}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {isDraft ? (
              <Button
                label="Start session"
                size="lg"
                onPress={() => void run(async () => {
                  await api.startSession(sessionId);
                })}
                disabled={busy}
              />
            ) : null}
            {isActive ? (
              <Button
                label="End session"
                variant="secondary"
                onPress={() => confirmEnd(false)}
                disabled={busy}
              />
            ) : null}
            {isDraft ? (
              <Button
                label="Add players"
                variant="secondary"
                onPress={() => setShowAddPlayers(true)}
                disabled={busy}
              />
            ) : null}
          </View>
        </Card>

        {isActive ? (
          <Section
            title="Pipeline"
            action={
              <Button
                label="Suggest matchup"
                variant="secondary"
                onPress={() => void suggestLineup()}
                disabled={busy || queued.length < (session.format === "singles" ? 2 : 4)}
              />
            }
          >
            {nextUpNext ? (
              <>
                <Text style={[styles.subheading, { color: theme.textSecondary }]}>Up next</Text>
                <LineupCard
                  match={nextUpNext}
                  busy={busy}
                  onEdit={() => setEditTarget(nextUpNext)}
                  onDemote={() => void run(() => api.demoteLineup(nextUpNext.id))}
                  onAssign={() => setAssignTarget(nextUpNext)}
                  onCancel={() => void run(() => api.cancelLineup(nextUpNext.id))}
                />
              </>
            ) : null}

            <Text style={[styles.subheading, { color: theme.textSecondary }]}>
              Preparation
            </Text>
            {preparing.length === 0 ? (
              <Text style={[styles.muted, { color: theme.textMuted }]}>
                No lineup waiting. Use “Suggest matchup” to build one.
              </Text>
            ) : (
              preparing.map((match) => (
                <LineupCard
                  key={match.id}
                  match={match}
                  busy={busy}
                  onEdit={() => setEditTarget(match)}
                  onPromote={() => void run(() => api.promoteLineup(match.id))}
                  onCancel={() => void run(() => api.cancelLineup(match.id))}
                />
              ))
            )}
          </Section>
        ) : null}

        {courts.length > 0 ? (
          <Section title="Courts">
            {courts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                busy={busy}
                canAssign={!court.match && Boolean(nextUpNext)}
                onAssign={
                  nextUpNext
                    ? () => void run(() => api.assignLineupToCourt(nextUpNext.id, court.id))
                    : undefined
                }
                onOpenMatch={(match) =>
                  router.push({
                    pathname: "/match/[matchId]",
                    params: { matchId: match.id, sessionId, clubName },
                  })
                }
                onStart={(match) => void run(() => api.startMatch(match.id))}
                onCancel={(match) => void run(() => api.cancelLineup(match.id))}
              />
            ))}
          </Section>
        ) : null}

        <Section
          title={`Players (${roster.length})`}
          action={
            <Button
              label="Add"
              variant="ghost"
              onPress={() => setShowAddPlayers(true)}
              disabled={busy}
            />
          }
        >
          <Card style={styles.rosterCard}>
            {roster.length === 0 ? (
              <Text style={[styles.muted, { color: theme.textMuted }]}>
                No players yet. Add them from the club roster.
              </Text>
            ) : (
              roster.map((player, index) => (
                <AttendanceRow
                  key={player.id}
                  player={player}
                  busy={busy}
                  estimatedWaitMinutes={estimatedWaitMinutes({
                    queuePosition: player.attendance_status === "waiting" ? index + 1 : null,
                    courtCount: session.court_count,
                    averageMatchMinutes: 15,
                  })}
                  onCheckIn={() => void run(() => checkInPlayer(sessionId, player.player_id))}
                  onCheckOut={() =>
                    void run(() => api.setAttendance(sessionId, player.player_id, "checked_out"))
                  }
                  onBreak={() =>
                    void run(() => api.setAttendance(sessionId, player.player_id, "break"))
                  }
                  onReturn={() =>
                    void run(() => api.setAttendance(sessionId, player.player_id, "waiting"))
                  }
                />
              ))
            )}
          </Card>
        </Section>

        <Section title="Standings">
          {standings.data && standings.data.length > 0 ? (
            <Card style={styles.rosterCard}>
              {standings.data.map((row, index) => (
                <View key={row.player_id} style={[styles.standingRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.rank, { color: theme.textMuted }]}>{index + 1}</Text>
                  <Text style={[styles.standingName, { color: theme.text }]} numberOfLines={1}>
                    {row.display_name}
                  </Text>
                  <Text style={[styles.standingStat, { color: theme.textSecondary }]}>
                    {row.wins}-{row.losses}
                  </Text>
                  <Text style={[styles.standingStat, { color: theme.textMuted }]}>
                    {row.points_for} pts
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <Text style={[styles.muted, { color: theme.textMuted }]}>No results yet.</Text>
          )}
        </Section>
      </ScrollView>

      <AssignCourtModal
        visible={assignTarget !== null}
        courts={courts}
        busy={busy}
        onClose={() => setAssignTarget(null)}
        onSelect={(courtId) => {
          const target = assignTarget;
          setAssignTarget(null);
          if (target) void run(() => api.assignLineupToCourt(target.id, courtId));
        }}
      />

      <AddPlayersModal
        visible={showAddPlayers}
        roster={clubRoster.data ?? []}
        sessionPlayerIds={sessionPlayerIds}
        busy={busy}
        onClose={() => setShowAddPlayers(false)}
        onAdd={(ids) => {
          setShowAddPlayers(false);
          if (ids.length) void run(() => api.addSessionPlayers(sessionId, ids));
        }}
      />

      {editTarget ? (
        <EditLineupModal
          visible
          title="Edit lineup"
          format={session.format}
          busy={busy}
          candidates={mergeCandidates(editTarget, roster)}
          initialSelectedIds={editTarget.players.map((p) => p.player_id)}
          onClose={() => setEditTarget(null)}
          onSave={(input) => {
            const target = editTarget;
            setEditTarget(null);
            void run(() => api.updateLineupPlayers({ matchId: target.id, ...input }));
          }}
        />
      ) : null}
    </Screen>
  );
}

/** Available players plus the lineup's current players, de-duplicated. */
function mergeCandidates(
  match: MatchWithPlayers,
  roster: SessionPlayer[],
): SessionPlayer[] {
  const available = availableForQueue(roster);
  const result = new Map<string, SessionPlayer>();
  for (const player of match.players) {
    const row = roster.find((r) => r.player_id === player.player_id);
    if (row) result.set(row.player_id, row);
  }
  for (const row of available) {
    result.set(row.player_id, row);
  }
  return [...result.values()];
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  statusCard: { gap: Spacing.two },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  statusMeta: { fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, marginTop: Spacing.one },
  subheading: { fontSize: 13, fontWeight: "600", marginTop: Spacing.one },
  muted: { fontSize: 14 },
  rosterCard: { gap: 0, paddingVertical: 0 },
  standingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { width: 20, fontSize: 13, fontWeight: "700" },
  standingName: { flex: 1, fontSize: 15, fontWeight: "600" },
  standingStat: { fontSize: 13, minWidth: 48, textAlign: "right" },
  notice: { fontSize: 14 },
});
