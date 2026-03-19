export interface AppTheme {
  id: string;
  name: string;
  bgColor: string;
  accentColor: string;
  cardBgColor: string;
  textColor: string;
  mutedTextColor: string;
  dangerColor: string;
  successColor: string;
  warningColor: string;
  customImagePath: string | null;
}

export type OverlayTheme = AppTheme;

export const APP_THEMES: Record<string, AppTheme> = {
  default: {
    id: "default",
    name: "Dark Forest",
    bgColor: "#0B1215",
    accentColor: "#2DD4BF",
    cardBgColor: "#1A2421",
    textColor: "#FFFFFF",
    mutedTextColor: "#CBD5E1",
    dangerColor: "#EF4444",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    customImagePath: null,
  },
  midnight: {
    id: "midnight",
    name: "Midnight Blue",
    bgColor: "#0A0E1A",
    accentColor: "#6366F1",
    cardBgColor: "#151B2E",
    textColor: "#FFFFFF",
    mutedTextColor: "#CBD5E1",
    dangerColor: "#EF4444",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    customImagePath: null,
  },
  crimson: {
    id: "crimson",
    name: "Crimson Steel",
    bgColor: "#1A0A0A",
    accentColor: "#DC2626",
    cardBgColor: "#2A1515",
    textColor: "#FFFFFF",
    mutedTextColor: "#CBD5E1",
    dangerColor: "#DC2626",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    customImagePath: null,
  },
  ocean: {
    id: "ocean",
    name: "Deep Ocean",
    bgColor: "#0A1A1A",
    accentColor: "#06B6D4",
    cardBgColor: "#122828",
    textColor: "#FFFFFF",
    mutedTextColor: "#CBD5E1",
    dangerColor: "#EF4444",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    customImagePath: null,
  },
  slate: {
    id: "slate",
    name: "Clean Slate",
    bgColor: "#1E293B",
    accentColor: "#F59E0B",
    cardBgColor: "#334155",
    textColor: "#FFFFFF",
    mutedTextColor: "#CBD5E1",
    dangerColor: "#EF4444",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    customImagePath: null,
  },
  nano: {
    id: "nano",
    name: "Nano Banana",
    bgColor: "#141105",
    accentColor: "#FDE047",
    cardBgColor: "#27220B",
    textColor: "#FEF08A",
    mutedTextColor: "#A16207",
    dangerColor: "#EF4444",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    customImagePath: null,
  },
};

export const OVERLAY_THEMES = APP_THEMES;

export function getResolvedTheme(
  id: string,
  customImagePath?: string | null,
): AppTheme {
  const theme = APP_THEMES[id] ?? APP_THEMES.default;
  return customImagePath ? { ...theme, customImagePath } : theme;
}
