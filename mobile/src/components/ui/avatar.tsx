import { StyleSheet, Text, View, type ViewProps } from "react-native";

import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { initialsOf } from "@/lib/format";

export interface AvatarProps extends ViewProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 40, style, ...rest }: AvatarProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: Radius.pill,
          backgroundColor: theme.primarySoft,
        },
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.text, { color: theme.primary, fontSize: size * 0.4 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "700" },
});
