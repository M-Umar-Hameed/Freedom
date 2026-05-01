import { useAppTheme } from "@/providers/ThemeProvider";
import { useMemo } from "react";
import type { TextStyle, ViewStyle } from "react-native";

interface ThemeStyles {
  bg: ViewStyle;
  card: ViewStyle;
  accentBg: ViewStyle;
  text: TextStyle;
  muted: TextStyle;
  accent: TextStyle;
  border: ViewStyle;
}

export function useThemeStyles(): ThemeStyles {
  const t = useAppTheme();
  return useMemo(
    () => ({
      bg: { backgroundColor: t.bgColor },
      card: { backgroundColor: t.cardBgColor },
      accentBg: { backgroundColor: t.accentColor },
      text: { color: t.textColor },
      muted: { color: t.mutedTextColor },
      accent: { color: t.accentColor },
      border: { borderColor: t.cardBgColor },
    }),
    [t],
  );
}
