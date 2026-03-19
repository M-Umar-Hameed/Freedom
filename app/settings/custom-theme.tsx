import { APP_THEMES, type AppTheme } from "@/constants/overlay-themes";
import * as FreedomAccessibility from "@/modules/freedom-accessibility-service/src";
import * as FreedomOverlay from "@/modules/freedom-overlay/src";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAppStore } from "@/stores/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import ColorPicker, {
  HueSlider,
  Panel1,
  Preview,
  BrightnessSlider,
} from "reanimated-color-picker";

type ColorField = "bg" | "accent" | "card";

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function deriveTextColors(bgHex: string): {
  textColor: string;
  mutedTextColor: string;
} {
  const isDark = luminance(bgHex) < 0.2;
  return {
    textColor: isDark ? "#FFFFFF" : "#1A1A1A",
    mutedTextColor: isDark ? "#94A3B8" : "#64748B",
  };
}

function closestPresetId(bgHex: string): string {
  const parse = (h: string): number[] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r, g, b] = parse(bgHex);
  let best = "default";
  let bestDist = Infinity;
  for (const p of Object.values(APP_THEMES)) {
    const [pr, pg, pb] = parse(p.bgColor);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p.id;
    }
  }
  return best;
}

export default function CustomThemeScreen(): ReactNode {
  const router = useRouter();
  const currentTheme = useAppTheme();
  const { customTheme, setCustomTheme, setAppThemeId, overlayCustomImage } =
    useAppStore();

  const base = customTheme ?? currentTheme;
  const [bgColor, setBgColor] = useState(base.bgColor);
  const [accentColor, setAccentColor] = useState(base.accentColor);
  const [cardBgColor, setCardBgColor] = useState(base.cardBgColor);
  const [activeField, setActiveField] = useState<ColorField>("accent");

  const activeColor =
    activeField === "bg"
      ? bgColor
      : activeField === "accent"
        ? accentColor
        : cardBgColor;

  const applyColor = useCallback(
    (hex: string) => {
      const clean = hex.slice(0, 7);
      if (activeField === "bg") setBgColor(clean);
      else if (activeField === "accent") setAccentColor(clean);
      else setCardBgColor(clean);
    },
    [activeField],
  );

  const derived = deriveTextColors(bgColor);

  const handleSave = (): void => {
    const theme: AppTheme = {
      id: "custom",
      name: "Custom",
      bgColor,
      accentColor,
      cardBgColor,
      textColor: derived.textColor,
      mutedTextColor: derived.mutedTextColor,
      dangerColor: "#EF4444",
      successColor: "#10B981",
      warningColor: "#F59E0B",
      customImagePath: overlayCustomImage ?? null,
    };
    setCustomTheme(theme);
    setAppThemeId("custom");

    const json = JSON.stringify(theme);
    Promise.all([
      FreedomOverlay.updateOverlayTheme(json),
      FreedomAccessibility.updateOverlayTheme(json),
    ]).catch((e: unknown) => {
      console.warn("[CustomTheme] Sync failed:", e);
    });

    const iconId = closestPresetId(bgColor);
    void Promise.resolve().then(() => {
      try {
        const { setAppIcon } = require("expo-dynamic-app-icon");
        setAppIcon(iconId === "default" ? "forest" : iconId);
      } catch {
        // icon switch not available
      }
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const fields: { key: ColorField; label: string; color: string }[] = [
    { key: "accent", label: "Accent", color: accentColor },
    { key: "bg", label: "Background", color: bgColor },
    { key: "card", label: "Card", color: cardBgColor },
  ];

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: currentTheme.bgColor }}
      edges={["top"]}
    >
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              router.back();
            }}
            className="mr-3 p-1"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={currentTheme.mutedTextColor}
            />
          </Pressable>
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: currentTheme.textColor }}
          >
            Custom Theme
          </Text>
        </View>

        {/* Live Preview */}
        <View
          className="rounded-2xl p-4 mb-6"
          style={{
            backgroundColor: bgColor,
            borderWidth: 1,
            borderColor: cardBgColor,
          }}
        >
          <View
            style={{
              height: 4,
              backgroundColor: accentColor,
              borderRadius: 2,
              marginBottom: 12,
            }}
          />
          <View
            className="rounded-xl p-3 mb-3"
            style={{ backgroundColor: cardBgColor }}
          >
            <Text
              style={{ color: accentColor, fontWeight: "700", fontSize: 14 }}
            >
              BLOCKED
            </Text>
            <Text
              style={{
                color: derived.mutedTextColor,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              This is how your overlay will look
            </Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text style={{ color: derived.textColor, fontWeight: "600" }}>
              Preview
            </Text>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: accentColor }}
            >
              <Text style={{ color: bgColor, fontWeight: "700", fontSize: 12 }}>
                Button
              </Text>
            </View>
          </View>
        </View>

        {/* Color Field Selector */}
        <Text
          className="text-sm font-semibold uppercase mb-3"
          style={{ color: currentTheme.mutedTextColor }}
        >
          Pick a color for
        </Text>
        <View className="flex-row mb-4">
          {fields.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => {
                void Haptics.selectionAsync();
                setActiveField(f.key);
              }}
              className="flex-1 flex-row items-center justify-center py-2.5 mx-1 rounded-xl"
              style={{
                backgroundColor:
                  activeField === f.key
                    ? currentTheme.accentColor + "1A"
                    : currentTheme.cardBgColor,
                borderWidth: activeField === f.key ? 1 : 0,
                borderColor: currentTheme.accentColor,
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: f.color,
                  marginRight: 6,
                  borderWidth: 1,
                  borderColor: "#666",
                }}
              />
              <Text
                className="text-xs font-semibold"
                style={{
                  color:
                    activeField === f.key
                      ? currentTheme.accentColor
                      : currentTheme.mutedTextColor,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Color Picker */}
        <View
          className="rounded-2xl p-4 mb-6"
          style={{ backgroundColor: currentTheme.cardBgColor }}
        >
          <ColorPicker
            value={activeColor}
            onComplete={(result) => {
              "worklet";
              runOnJS(applyColor)(result.hex);
            }}
            style={{ gap: 16 }}
          >
            <Preview hideInitialColor />
            <Panel1 style={{ height: 180, borderRadius: 12 }} />
            <HueSlider style={{ borderRadius: 12 }} />
            <BrightnessSlider style={{ borderRadius: 12 }} />
          </ColorPicker>
        </View>

        {/* Preset Starters */}
        <Text
          className="text-sm font-semibold uppercase mb-3"
          style={{ color: currentTheme.mutedTextColor }}
        >
          Start from preset
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6"
        >
          {Object.values(APP_THEMES).map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setBgColor(preset.bgColor);
                setAccentColor(preset.accentColor);
                setCardBgColor(preset.cardBgColor);
              }}
              className="mr-3 items-center"
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: preset.bgColor,
                  borderWidth: 3,
                  borderColor: preset.accentColor,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: preset.accentColor,
                  }}
                />
              </View>
              <Text
                className="text-[10px] mt-1 font-semibold"
                style={{ color: currentTheme.mutedTextColor }}
              >
                {preset.name.split(" ")[0]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Save */}
        <Pressable
          onPress={handleSave}
          className="py-4 rounded-2xl items-center"
          style={{ backgroundColor: accentColor }}
        >
          <Text style={{ color: bgColor, fontWeight: "700", fontSize: 16 }}>
            Apply Custom Theme
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
