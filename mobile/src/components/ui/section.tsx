import { StyleSheet, Text, View, type ViewProps } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** A titled block used to group a screen's content. */
export function Section({
  title,
  action,
  children,
  style,
  ...rest
}: ViewProps & { title: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, style]} {...rest}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
