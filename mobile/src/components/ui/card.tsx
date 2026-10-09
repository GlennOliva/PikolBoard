import { StyleSheet, View, type ViewProps } from "react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        style,
      ]}
      {...rest}
    />
  );
}

/** A thin horizontal rule that respects the theme border color. */
export function Divider({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  divider: { height: StyleSheet.hairlineWidth, width: "100%" },
});
