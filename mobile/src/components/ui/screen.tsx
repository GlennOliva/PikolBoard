import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** A themed page container that centers content on wide screens. */
export function Screen({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.screen, { backgroundColor: theme.background }, style]}
      {...rest}
    >
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Text style={[styles.backGlyph, { color: theme.primary }]}>‹</Text>
          </Pressable>
        ) : null}
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

/** Header back action that pops the stack, falling back to home. */
export function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: "100%", maxWidth: MaxContentWidth, alignSelf: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.two, flex: 1 },
  titleWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  backGlyph: { fontSize: 30, lineHeight: 32, fontWeight: "400" },
  pressed: { opacity: 0.6 },
});
