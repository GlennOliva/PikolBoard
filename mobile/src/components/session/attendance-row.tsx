import { StyleSheet, Text, View } from "react-native";

import { Avatar, Badge, Button } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { attendanceLabel } from "@/lib/domain/live-board/wait-time";
import { formatEstimatedWait } from "@/lib/domain/live-board/wait-time";
import type { SessionPlayer } from "@/types/database";

export interface AttendanceRowProps {
  player: SessionPlayer;
  estimatedWaitMinutes?: number | null;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onBreak?: () => void;
  onReturn?: () => void;
  busy?: boolean;
}

export function AttendanceRow({
  player,
  estimatedWaitMinutes,
  onCheckIn,
  onCheckOut,
  onBreak,
  onReturn,
  busy,
}: AttendanceRowProps) {
  const theme = useTheme();
  const status = player.attendance_status;

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Avatar name={player.display_name} size={36} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {player.display_name}
        </Text>
        <View style={styles.metaRow}>
          <Badge label={attendanceLabel(status)} tone={toneFor(status)} />
          {status === "waiting" && estimatedWaitMinutes != null ? (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {formatEstimatedWait(estimatedWaitMinutes)}
            </Text>
          ) : null}
          {player.games_played > 0 ? (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {player.games_played} played
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {status === "checked_out" && onCheckIn ? (
          <Button label="Check in" variant="secondary" onPress={onCheckIn} disabled={busy} />
        ) : null}
        {status === "waiting" && onBreak ? (
          <Button label="Break" variant="ghost" onPress={onBreak} disabled={busy} />
        ) : null}
        {status === "break" && onReturn ? (
          <Button label="Queue" variant="ghost" onPress={onReturn} disabled={busy} />
        ) : null}
        {status !== "checked_out" && onCheckOut ? (
          <Button label="Out" variant="ghost" onPress={onCheckOut} disabled={busy} />
        ) : null}
      </View>
    </View>
  );
}

function toneFor(status: SessionPlayer["attendance_status"]): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "waiting":
      return "info";
    case "staged":
      return "warning";
    case "playing":
      return "success";
    case "finished":
      return "neutral";
    case "break":
      return "neutral";
    default:
      return "neutral";
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, flexWrap: "wrap" },
  meta: { fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
});
