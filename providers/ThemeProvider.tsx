import { APP_THEMES, type AppTheme } from "@/constants/overlay-themes";
import { useAppStore } from "@/stores/useAppStore";
import { createContext, useContext, type ReactNode } from "react";

const ThemeContext = createContext<AppTheme>(APP_THEMES.default);

export function AppThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const appThemeId = useAppStore((s) => s.appThemeId);
  const customTheme = useAppStore((s) => s.customTheme);

  const theme =
    appThemeId === "custom" && customTheme
      ? customTheme
      : (APP_THEMES[appThemeId] ?? APP_THEMES.default);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
