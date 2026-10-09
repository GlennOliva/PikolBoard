import { ActivityIndicator, StyleSheet, Text, View, type ViewProps } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.primary} />
      <Text style={[styles.muted, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  style,
  ...rest
}: ViewProps & {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.center, style]} {...rest}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.muted, styles.centerText, { color: theme.textSecondary }]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: theme.dangerSoft, borderColor: theme.danger },
      ]}
    >
      <Text style={[styles.noticeText, { color: theme.danger }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  centerText: { textAlign: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  muted: { fontSize: 15 },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.three,
  },
  noticeText: { fontSize: 14, fontWeight: "500" },
});
