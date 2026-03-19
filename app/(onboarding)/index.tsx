import { useAppTheme } from "@/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen(): ReactNode {
  const t = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  const features = [
    {
      icon: "globe-outline",
      text: "Blocks adult websites across all browsers",
    },
    {
      icon: "videocam-outline",
      text: "Blocks reels and short-form content",
    },
    {
      icon: "lock-closed-outline",
      text: "Persistent protection that cannot be easily bypassed",
    },
    {
      icon: "shield-checkmark-outline",
      text: "Works fully offline -- no data leaves your device",
    },
  ] as const;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.bgColor }}>
      <Animated.View
        className="flex-1 justify-center items-center px-8"
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <Animated.View
          className="w-32 h-32 rounded-full items-center justify-center mb-8 border shadow-2xl"
          style={{
            backgroundColor: t.accentColor + "26",
            borderColor: t.accentColor + "4D",
            transform: [{ scale: scaleAnim }],
          }}
        >
          <View
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: t.accentColor + "0D" }}
          />
          <Ionicons name="shield-checkmark" size={60} color={t.accentColor} />
        </Animated.View>

        <Text
          className="text-4xl font-bold text-center mb-3"
          style={{ color: t.textColor }}
        >
          LibreAscent
        </Text>
        <Text
          className="text-lg text-center mb-2 font-medium"
          style={{ color: t.accentColor }}
        >
          Break free from addiction
        </Text>
        <Text
          className="text-center mb-10 leading-6"
          style={{ color: t.mutedTextColor }}
        >
          LibreAscent protects you by blocking harmful content across all
          browsers and apps on your device.
        </Text>

        <View className="w-full gap-5 mb-12">
          {features.map((feature, index) => (
            <Animated.View
              key={index}
              className="flex-row items-center"
              style={{
                opacity: fadeAnim,
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 20 * (index + 1)],
                    }),
                  },
                ],
              }}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-4 border"
                style={{
                  backgroundColor: t.cardBgColor + "80",
                  borderColor: t.accentColor + "1A",
                }}
              >
                <Ionicons
                  name={feature.icon as ComponentProps<typeof Ionicons>["name"]}
                  size={20}
                  color={t.accentColor}
                />
              </View>
              <Text
                className="flex-1 text-base leading-6"
                style={{ color: t.textColor }}
              >
                {feature.text}
              </Text>
            </Animated.View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            router.push("/(onboarding)/permissions");
          }}
          className="w-full py-4 rounded-2xl items-center active:opacity-90 shadow-lg"
          style={{ backgroundColor: t.accentColor, minHeight: 58 }}
        >
          <Text
            className="text-xl font-black tracking-tight"
            style={{ color: t.bgColor }}
          >
            GET STARTED
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
