/**
 * Design tokens for the app. Colors are semantic (background, card, text,
 * primary, ...) rather than literal so screens read the same in light and dark
 * mode and a palette change happens in exactly one place.
 */

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#10231A",
    background: "#F4F7F4",
    card: "#FFFFFF",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#E6EDE8",
    textSecondary: "#5B6B62",
    textMuted: "#8A968F",
    border: "#DCE3DE",
    primary: "#157A46",
    primaryText: "#FFFFFF",
    primarySoft: "#E3F3EA",
    accent: "#F2B705",
    success: "#1F9D55",
    successSoft: "#E3F5EA",
    warning: "#B45309",
    warningSoft: "#FDF1E0",
    danger: "#DC2626",
    dangerSoft: "#FCE8E8",
    info: "#2563EB",
    infoSoft: "#E6EEFE",
    overlay: "rgba(16, 35, 26, 0.45)",
    // Court and match status colors, read by the live board legend.
    courtAvailable: "#8A968F",
    courtStaged: "#B45309",
    courtPlaying: "#157A46",
    courtDisabled: "#DCE3DE",
  },
  dark: {
    text: "#F2F5F3",
    background: "#0B0F0C",
    card: "#141A16",
    backgroundElement: "#141A16",
    backgroundSelected: "#1E2620",
    textSecondary: "#A9B4AD",
    textMuted: "#747F78",
    border: "#26302A",
    primary: "#34D399",
    primaryText: "#04120A",
    primarySoft: "#12331F",
    accent: "#FBBF24",
    success: "#34D399",
    successSoft: "#12331F",
    warning: "#FBBF24",
    warningSoft: "#3A2E12",
    danger: "#F87171",
    dangerSoft: "#3A1D1D",
    info: "#60A5FA",
    infoSoft: "#16233A",
    overlay: "rgba(0, 0, 0, 0.6)",
    courtAvailable: "#747F78",
    courtStaged: "#FBBF24",
    courtPlaying: "#34D399",
    courtDisabled: "#26302A",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const MaxContentWidth = 720;
