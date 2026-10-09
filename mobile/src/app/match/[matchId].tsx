import { useEffect, useMemo, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
import { EditLineupModal } from "@/components/session/modals";
import { Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useAsyncData } from "@/hooks/use-async-data";
import { useTheme } from "@/hooks/use-theme";
import * as api from "@/lib/mutations";
import { messageFromError } from "@/lib/mutations";
import { getMatchWithPlayers, getSession, getSessionBundle } from "@/lib/queries";
import { groupTeams, teamLabel } from "@/lib/lineup";
import { validateScore, type TargetScore, type WinBy } from "@/lib/domain/scoring/validate-score";
import { formatTime } from "@/lib/format";
import type { SessionPlayer } from "@/types/database";
import type { MatchWithPlayers } from "@/types/session";

export default function MatchScreen() {
  const { session: authSession, isLoading } = useAuth();
  const params = useLocalSearchParams<{ matchId: string; clubName?: string }>();
  const matchId = params.matchId;

  const matchData = useAsyncData(() => getMatchWithPlayers(matchId), [matchId]);
  const match = matchData.data;
  const sessionId = match?.session_id;

  const sessionData = useAsyncData(
    () => (sessionId ? getSession(sessionId) : Promise.resolve(null)),
    [sessionId],
  );
  const bundle = useAsyncData(
    () => (sessionId ? getSessionBundle(sessionId) : Promise.resolve(null)),
    [sessionId],
  );

  const [team1, setTeam1] = useState(0);
  const [team2, setTeam2] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (match) {
      setTeam1(match.team1_score ?? 0);
      setTeam2(match.team2_score ?? 0);
    }
  }, [match]);

  const session = sessionData.data;
  const roster = bundle.data?.roster ?? [];
  const targetScore = (match?.target_score ?? session?.target_score ?? 11) as TargetScore;
  const winBy = (match?.win_by ?? session?.win_by ?? 1) as WinBy;

  const validation = useMemo(
    () => validateScore({ team1Score: team1, team2Score: team2, targetScore, winBy }),
    [team1, team2, targetScore, winBy],
  );

  async function run(fn: () => Promise<unknown>, successNotice?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await matchData.reload();
      if (successNotice) setNotice(successNotice);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!authSession) return <Redirect href="/login" />;

  if (matchData.loading && !match) {
    return (
      <Screen>
        <ScreenHeader title="Match" onBack={goBack} />
        <LoadingState />
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <ScreenHeader title="Match" onBack={goBack} />
        <EmptyState title="Match not found" message={matchData.error ?? undefined} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={match.display_name ?? `Match ${match.match_number}`}
        subtitle={params.clubName ?? "Match"}
        onBack={goBack}
        right={
          isEditable(match) ? (
            <Button
              label="Edit"
              variant="ghost"
              onPress={() => setShowEditor(true)}
              disabled={busy}
            />
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <ErrorNotice message={error} /> : null}
        {notice ? <SuccessNotice text={notice} /> : null}

        <ScoreCard
          match={match}
          team1={team1}
          team2={team2}
          targetScore={targetScore}
          winBy={winBy}
          validation={validation}
          busy={busy}
          onChangeTeam1={setTeam1}
          onChangeTeam2={setTeam2}
          onStart={() => void run(() => api.startMatch(match.id))}
          onSaveScore={() => void run(() => api.setRunningScore(match.id, team1, team2))}
          onFinish={() => {
            if (!validation.valid) {
              setError(validation.error);
              return;
            }
            void run(() => api.completeMatch(match.id, team1, team2));
          }}
          onError={(message) => setError(message)}
        />

        {session ? (
          <Section title="Details">
            <Card style={styles.detailsCard}>
              <Detail label="Format" value={session.format} />
              <Detail label="Matchmaking" value={session.matching_mode} />
              <Detail label="Status" value={match.status} />
              {match.explanation ? (
                <Detail label="Reasoning" value={match.explanation} />
              ) : null}
            </Card>
          </Section>
        ) : null}
      </ScrollView>

      {showEditor ? (
        <EditLineupModal
          visible
          title="Edit lineup"
          format={session?.format ?? "doubles"}
          busy={busy}
          candidates={mergeCandidates(match, roster)}
          initialSelectedIds={match.players.map((p) => p.player_id)}
          onClose={() => setShowEditor(false)}
          onSave={(input) => {
            setShowEditor(false);
            void run(() => api.updateLineupPlayers({ matchId: match.id, ...input }));
          }}
        />
      ) : null}
    </Screen>
  );
}

function isEditable(match: MatchWithPlayers): boolean {
  return (
    match.status === "preparing" ||
    match.status === "up_next" ||
    match.status === "staged"
  );
}

function SuccessNotice({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.notice, { color: theme.success }]}>{text}</Text>;
}

function ScoreCard({
  match,
  team1,
  team2,
  targetScore,
  winBy,
  validation,
  busy,
  onChangeTeam1,
  onChangeTeam2,
  onStart,
  onSaveScore,
  onFinish,
  onError,
}: {
  match: MatchWithPlayers;
  team1: number;
  team2: number;
  targetScore: TargetScore;
  winBy: WinBy;
  validation: ReturnType<typeof validateScore>;
  busy: boolean;
  onChangeTeam1: (n: number) => void;
  onChangeTeam2: (n: number) => void;
  onStart: () => void;
  onSaveScore: () => void;
  onFinish: () => void;
  onError: (message: string) => void;
}) {
  const theme = useTheme();
  const { team1: t1Players, team2: t2Players } = groupTeams(match.players);
  const isPlaying = match.status === "playing";
  const isStaged = match.status === "staged";

  return (
    <Card style={styles.scoreCard}>
      <View style={styles.scoreHeader}>
        <Badge label={match.status} tone={isPlaying ? "success" : "neutral"} />
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          First to {targetScore}
          {winBy === 2 ? ", win by 2" : ""}
        </Text>
      </View>

      <ScoreRow
        label={teamLabel(t1Players)}
        score={team1}
        leader={validation.valid && validation.winningTeam === 1}
        onChange={onChangeTeam1}
        disabled={!isPlaying || busy}
      />
      <ScoreRow
        label={teamLabel(t2Players)}
        score={team2}
        leader={validation.valid && validation.winningTeam === 2}
        onChange={onChangeTeam2}
        disabled={!isPlaying || busy}
      />

      {isPlaying && !validation.valid ? (
        <Text style={[styles.validation, { color: theme.danger }]}>{validation.error}</Text>
      ) : null}

      <View style={styles.actions}>
        {isStaged ? (
          <Button label="Start match" size="lg" onPress={onStart} disabled={busy} />
        ) : null}
        {isPlaying ? (
          <>
            <Button
              label="Save running score"
              variant="secondary"
              onPress={onSaveScore}
              disabled={busy}
            />
            <Button
              label="Finish match"
              onPress={() => {
                if (!validation.valid) {
                  onError(validation.error);
                  return;
                }
                onFinish();
              }}
              disabled={busy}
            />
          </>
        ) : null}
        {match.status === "completed" ? (
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {match.winning_team ? `Team ${match.winning_team} won` : "Completed"}
            {match.completed_at ? ` at ${formatTime(match.completed_at)}` : ""}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function ScoreRow({
  label,
  score,
  leader,
  onChange,
  disabled,
}: {
  label: string;
  score: number;
  leader: boolean;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.scoreRow, { borderColor: leader ? theme.primary : theme.border }]}>
      <Text style={[styles.teamLabel, { color: theme.text }]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.stepper}>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(Math.max(0, score - 1))}
          style={[styles.step, { backgroundColor: theme.backgroundSelected }, disabled && styles.dim]}
        >
          <Text style={[styles.stepGlyph, { color: theme.text }]}>−</Text>
        </Pressable>
        <Text style={[styles.scoreValue, { color: theme.text }]}>{score}</Text>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(score + 1)}
          style={[styles.step, { backgroundColor: theme.primary }, disabled && styles.dim]}
        >
          <Text style={[styles.stepGlyph, { color: theme.primaryText }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

/** The lineup's current players plus anyone available, de-duplicated. */
function mergeCandidates(match: MatchWithPlayers, roster: SessionPlayer[]): SessionPlayer[] {
  const byId = new Map(roster.map((p) => [p.player_id, p]));
  const result = new Map<string, SessionPlayer>();
  for (const player of match.players) {
    const row = byId.get(player.player_id);
    if (row) result.set(row.player_id, row);
  }
  for (const row of roster) {
    if (row.attendance_status === "waiting" || row.attendance_status === "break") {
      result.set(row.player_id, row);
    }
  }
  return [...result.values()];
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four },
  notice: { fontSize: 14 },
  scoreCard: { gap: Spacing.three },
  scoreHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meta: { fontSize: 13 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  teamLabel: { flex: 1, fontSize: 16, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  step: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { opacity: 0.5 },
  stepGlyph: { fontSize: 24, fontWeight: "700" },
  scoreValue: { fontSize: 34, fontWeight: "800", minWidth: 56, textAlign: "center" },
  validation: { fontSize: 13, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  detailsCard: { gap: Spacing.two },
  detailRow: { flexDirection: "row", gap: Spacing.two, justifyContent: "space-between" },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" },
});
