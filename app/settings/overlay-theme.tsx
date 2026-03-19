import { Asset } from "expo-asset";
import { useState } from "react";
import {
  getResolvedTheme,
  OVERLAY_THEMES,
  type OverlayTheme,
} from "@/constants/overlay-themes";
import * as FreedomAccessibility from "@/modules/freedom-accessibility-service/src";
import * as FreedomOverlay from "@/modules/freedom-overlay/src";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAppStore } from "@/stores/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const THEME_IDS = Object.keys(OVERLAY_THEMES);

const PREMADE_IMAGES = [
  {
    id: "mint",
    name: "Ascension Mint",
    source: require("@/assets/images/overlays/mint_ascension.png"),
  },
  {
    id: "banana",
    name: "Ascension Banana",
    source: require("@/assets/images/overlays/banana_ascension.png"),
  },
  {
    id: "adult",
    name: "Pure Discipline",
    source: require("@/assets/images/overlays/adult_block_bg.png"),
  },
  {
    id: "reels",
    name: "Deep Focus Time",
    source: require("@/assets/images/overlays/reels_block_bg.png"),
  },
  {
    id: "social",
    name: "Absolute Success",
    source: require("@/assets/images/overlays/social_block_bg.png"),
  },
];

function syncThemeToNative(theme: OverlayTheme): void {
  const { overlayTexts } = useAppStore.getState();
  const json = JSON.stringify({ ...theme, ...overlayTexts });
  Promise.all([
    FreedomOverlay.updateOverlayTheme(json),
    FreedomAccessibility.updateOverlayTheme(json),
  ]).catch((e: unknown) => {
    console.warn("[OverlayTheme] Failed to sync to native:", e);
  });
}

function ThemeCard({
  theme,
  selected,
  onPress,
}: {
  theme: OverlayTheme;
  selected: boolean;
  onPress: () => void;
}): ReactNode {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 min-w-[45%] m-1.5"
      style={{ opacity: selected ? 1 : 0.7 }}
    >
      <View
        style={{
          backgroundColor: theme.bgColor,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.accentColor : "#333",
          borderRadius: 12,
          padding: 12,
          minHeight: 100,
        }}
      >
        <View
          style={{
            height: 4,
            backgroundColor: theme.accentColor,
            borderRadius: 2,
            marginBottom: 8,
          }}
        />
        <View
          style={{
            backgroundColor: theme.cardBgColor,
            borderRadius: 6,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <Text
            style={{ color: theme.accentColor, fontSize: 8, fontWeight: "700" }}
          >
            BLOCKED
          </Text>
          <Text
            style={{ color: theme.mutedTextColor, fontSize: 7, marginTop: 2 }}
          >
            Stay disciplined
          </Text>
        </View>
        <Text
          style={{
            color: theme.textColor,
            fontSize: 12,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {theme.name}
        </Text>
        {selected && (
          <View className="absolute top-2 right-2">
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.accentColor}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function OverlayThemeScreen(): ReactNode {
  const t = useAppTheme();
  const router = useRouter();
  const {
    appThemeId,
    overlayCustomImage,
    overlayTexts,
    setAppThemeId,
    setOverlayCustomImage,
    setOverlayTexts,
  } = useAppStore();

  const [editingTexts, setEditingTexts] = useState(overlayTexts);

  const handleSelectTheme = (id: string): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAppThemeId(id);
    syncThemeToNative(getResolvedTheme(id, overlayCustomImage));
  };

  const handlePickPremadeImage = async (
    imgRequire: number,
    id: string,
  ): Promise<void> => {
    try {
      const [asset] = await Asset.loadAsync(imgRequire);
      const source = asset.localUri || asset.uri;
      if (!source) throw new Error("Could not get asset URI");
      const dest = `${FileSystem.documentDirectory}overlay-bg-${id}.jpg`;
      if (source.startsWith("http")) {
        await FileSystem.downloadAsync(source, dest);
      } else {
        await FileSystem.copyAsync({ from: source, to: dest });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOverlayCustomImage(dest);
      syncThemeToNative(getResolvedTheme(appThemeId, dest));
    } catch (e: unknown) {
      console.error("[OverlayTheme] Premade pic failed:", e);
      Alert.alert("Error", "Failed to set background image.");
    }
  };

  const handlePickImage = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const source = result.assets[0].uri;
      const dest = `${FileSystem.documentDirectory}overlay-bg.jpg`;
      await FileSystem.copyAsync({ from: source, to: dest });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOverlayCustomImage(dest);
      syncThemeToNative(getResolvedTheme(appThemeId, dest));
    } catch (e: unknown) {
      console.error("[OverlayTheme] Image pick failed:", e);
      Alert.alert("Error", "Failed to set custom background image.");
    }
  };

  const handleRemoveImage = async (): Promise<void> => {
    try {
      const path = `${FileSystem.documentDirectory}overlay-bg.jpg`;
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) await FileSystem.deleteAsync(path);
    } catch {
      // ignore cleanup errors
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOverlayCustomImage(null);
    syncThemeToNative(getResolvedTheme(appThemeId, null));
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: t.bgColor }}
      edges={["top"]}
    >
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              router.back();
            }}
            className="mr-3 p-1"
          >
            <Ionicons name="arrow-back" size={24} color={t.mutedTextColor} />
          </Pressable>
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: t.textColor }}
          >
            App Theme
          </Text>
        </View>

        {/* Theme Grid */}
        <Text
          className="text-sm font-semibold uppercase mb-3"
          style={{ color: t.mutedTextColor }}
        >
          Color Themes
        </Text>
        <View className="flex-row flex-wrap mb-4">
          {THEME_IDS.map((id) => (
            <ThemeCard
              key={id}
              theme={OVERLAY_THEMES[id]}
              selected={appThemeId === id && appThemeId !== "custom"}
              onPress={() => {
                handleSelectTheme(id);
              }}
            />
          ))}
        </View>

        {/* Create Custom Theme */}
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            router.push("/settings/custom-theme");
          }}
          className="flex-row items-center justify-between p-4 rounded-xl mb-6"
          style={{
            backgroundColor:
              appThemeId === "custom" ? t.accentColor + "1A" : t.cardBgColor,
            borderWidth: appThemeId === "custom" ? 1 : 0,
            borderColor: t.accentColor,
          }}
        >
          <View className="flex-row items-center">
            <Ionicons
              name="color-palette-outline"
              size={22}
              color={t.accentColor}
            />
            <View className="ml-3">
              <Text className="font-semibold" style={{ color: t.textColor }}>
                Create Custom Theme
              </Text>
              <Text className="text-xs" style={{ color: t.mutedTextColor }}>
                Pick your own colors with a color wheel
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            {appThemeId === "custom" && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={t.accentColor}
              />
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={t.mutedTextColor}
            />
          </View>
        </Pressable>

        {/* Custom Background Image */}
        <Text
          className="text-sm font-semibold uppercase mb-3"
          style={{ color: t.mutedTextColor }}
        >
          Custom & Curated Backgrounds
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        >
          {PREMADE_IMAGES.map((img) => (
            <Pressable
              key={img.id}
              onPress={() => void handlePickPremadeImage(img.source, img.id)}
              className="mr-3 items-center"
            >
              <Image
                source={img.source}
                style={{ width: 100, height: 140, borderRadius: 12 }}
                resizeMode="cover"
              />
              <Text
                className="text-[10px] mt-2 font-bold uppercase tracking-wider"
                style={{ color: t.mutedTextColor }}
              >
                {img.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View
          className="rounded-xl mb-6"
          style={{ backgroundColor: t.cardBgColor }}
        >
          {overlayCustomImage ? (
            <View className="p-4">
              <View
                className="rounded-lg overflow-hidden mb-3"
                style={{ height: 120 }}
              >
                <Image
                  source={{ uri: overlayCustomImage }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
                <View
                  className="absolute inset-0"
                  style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                />
                <View className="absolute inset-0 items-center justify-center">
                  <Text className="text-white font-bold text-lg">BLOCKED!</Text>
                  <Text
                    style={{
                      color:
                        OVERLAY_THEMES[appThemeId]?.accentColor ??
                        t.accentColor,
                    }}
                    className="text-xs font-bold uppercase"
                  >
                    Preview with scrim
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  void handleRemoveImage();
                }}
                className="bg-red-500/10 p-3 rounded-lg items-center"
              >
                <Text className="text-red-500 font-semibold">
                  Remove Background Image
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                void handlePickImage();
              }}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="image-outline"
                  size={20}
                  color={t.accentColor}
                />
                <View className="ml-3">
                  <Text style={{ color: t.textColor }}>
                    Upload Background Image
                  </Text>
                  <Text className="text-xs" style={{ color: t.mutedTextColor }}>
                    Shown behind the block overlay with a dark scrim
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={t.mutedTextColor}
              />
            </Pressable>
          )}
        </View>

        {/* Overlay Text */}
        <Text
          className="text-sm font-semibold uppercase mb-3"
          style={{ color: t.mutedTextColor }}
        >
          Overlay Text
        </Text>
        <View
          className="rounded-xl mb-6 p-4"
          style={{ backgroundColor: t.cardBgColor }}
        >
          {[
            { key: "title" as const, label: "Title", placeholder: "Blocked!" },
            {
              key: "subtitle" as const,
              label: "Subtitle",
              placeholder: "Stay Sharp - Stay Disciplined",
            },
            {
              key: "heading" as const,
              label: "Heading",
              placeholder: "You are on a mission...",
            },
            {
              key: "body" as const,
              label: "Body",
              placeholder: "Your motivational message...",
            },
          ].map((field, i) => (
            <View key={field.key} className={i > 0 ? "mt-3" : ""}>
              <Text
                className="text-xs font-semibold uppercase mb-1"
                style={{ color: t.mutedTextColor }}
              >
                {field.label}
              </Text>
              <TextInput
                value={editingTexts[field.key]}
                onChangeText={(text) => {
                  setEditingTexts((prev) => ({ ...prev, [field.key]: text }));
                }}
                onBlur={() => {
                  setOverlayTexts({ [field.key]: editingTexts[field.key] });
                }}
                placeholder={field.placeholder}
                placeholderTextColor={t.mutedTextColor + "66"}
                multiline={field.key === "body"}
                numberOfLines={field.key === "body" ? 3 : 1}
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: t.bgColor,
                  color: t.textColor,
                  borderWidth: 1,
                  borderColor: t.mutedTextColor + "33",
                  textAlignVertical: field.key === "body" ? "top" : "center",
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
