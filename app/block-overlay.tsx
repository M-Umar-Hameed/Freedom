import { getResolvedTheme } from "@/constants/overlay-themes";
import { useAppStore } from "@/stores/useAppStore";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BlockOverlayScreen(): ReactNode {
  const { appThemeId, customTheme, overlayCustomImage, overlayTexts } =
    useAppStore();
  const t =
    appThemeId === "custom" && customTheme
      ? { ...customTheme, customImagePath: overlayCustomImage ?? null }
      : getResolvedTheme(appThemeId, overlayCustomImage);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgColor }}>
      {t.customImagePath && (
        <>
          <Image
            source={{ uri: t.customImagePath }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            contentFit="cover"
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          />
        </>
      )}

      <View className="flex-1 justify-center items-center px-6">
        <View
          style={{
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: t.accentColor + "1A",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            borderWidth: 4,
            borderColor: t.accentColor + "80",
          }}
        >
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: t.accentColor + "33",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: t.accentColor + "4D",
            }}
          >
            <Ionicons name="flash" size={72} color={t.accentColor} />
          </View>
        </View>

        <Text
          style={{ color: t.textColor }}
          className="text-5xl font-black text-center mb-3 tracking-widest uppercase"
        >
          {overlayTexts.title}
        </Text>

        <Text
          style={{ color: t.accentColor }}
          className="text-xl font-bold text-center mb-10 tracking-widest uppercase"
        >
          {overlayTexts.subtitle}
        </Text>

        <View
          style={{
            backgroundColor: t.cardBgColor,
            borderTopWidth: 4,
            borderTopColor: t.accentColor,
          }}
          className="rounded-2xl p-6 w-full shadow-lg"
        >
          <View className="flex-row items-center justify-center mb-4">
            <Ionicons name="warning" size={24} color={t.accentColor} />
            <Text
              style={{ color: t.accentColor }}
              className="font-bold text-sm uppercase ml-2 tracking-widest"
            >
              Distraction Neutralized
            </Text>
          </View>
          <Text
            style={{ color: t.textColor }}
            className="text-center text-lg font-semibold leading-relaxed mb-2"
          >
            {overlayTexts.heading}
          </Text>
          <Text
            style={{ color: t.mutedTextColor }}
            className="text-center text-base leading-relaxed"
          >
            {overlayTexts.body}
          </Text>
        </View>

        <View
          style={{ backgroundColor: t.cardBgColor + "CC" }}
          className="mt-16 items-center px-8 py-4 rounded-full shadow-md"
        >
          <Text
            style={{ color: t.mutedTextColor }}
            className="font-bold uppercase tracking-widest text-xs"
          >
            Return to safety to dismiss
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
