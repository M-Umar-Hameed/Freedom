import { InteractionGuard } from "@/components/InteractionGuard";
import { REELS_APPS } from "@/constants/reels";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAppStore } from "@/stores/useAppStore";
import { useBlockingStore } from "@/stores/useBlockingStore";
import type { ControlMode, SurveillanceConfig } from "@/types/blocking";
import { getEffectiveMode, getEffectiveSurveillance } from "@/types/blocking";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CONTROL_MODES: {
  id: ControlMode;
  title: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  {
    id: "flexible",
    title: "Flexible",
    description: "No friction to unblock reels.",
    icon: "happy-outline",
    color: "#10B981",
  },
  {
    id: "locked",
    title: "Locked",
    description: "Requires friction to unblock reels.",
    icon: "shield-outline",
    color: "#F59E0B",
  },
  {
    id: "hardcore",
    title: "Hardcore",
    description: "Maximum protection. Extremely difficult to unblock.",
    icon: "flame-outline",
    color: "#EF4444",
  },
];

export default function BlockReelsScreen(): ReactNode {
  const t = useAppTheme();
  const {
    enabledReelsApps,
    toggleReelsApp,
    reelsControlMode,
    setReelsControlMode,
    reelsSurveillance,
    setReelsSurveillance,
  } = useBlockingStore();
  const { controlMode, surveillance } = useAppStore();

  const effectiveMode = getEffectiveMode(controlMode, reelsControlMode);
  const effectiveSurveillance = getEffectiveSurveillance(
    controlMode,
    surveillance,
    reelsControlMode,
    reelsSurveillance,
  );
  const isEffectiveFlexible = effectiveMode === "flexible";

  const [guardVisible, setGuardVisible] = useState(false);
  const [pendingTogglePkg, setPendingTogglePkg] = useState<string | null>(null);
  const [showModeModal, setShowModeModal] = useState(false);

  const [pendingMode, setPendingMode] = useState<ControlMode>(reelsControlMode);
  const [pendingSurveillance, setPendingSurveillance] =
    useState<SurveillanceConfig>(reelsSurveillance);
  const [modeGuardVisible, setModeGuardVisible] = useState(false);

  const handleToggleApp = (packageName: string): void => {
    const isCurrentlyEnabled = enabledReelsApps.includes(packageName);
    // Enabling (adding protection) is always free. Disabling needs guard.
    if (!isCurrentlyEnabled || isEffectiveFlexible) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toggleReelsApp(packageName);
    } else {
      setPendingTogglePkg(packageName);
      setGuardVisible(true);
    }
  };

  const handleSelectMode = (mode: ControlMode): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingMode(mode);
    if (
      (mode === "locked" || mode === "hardcore") &&
      pendingSurveillance.type === "none"
    ) {
      setPendingSurveillance({ type: "timer", value: 30 });
    }
  };

  const handleSaveMode = (): void => {
    if (effectiveMode === "flexible") {
      applyMode();
    } else {
      setShowModeModal(false);
      setModeGuardVisible(true);
    }
  };

  const applyMode = (): void => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReelsControlMode(pendingMode);
    setReelsSurveillance(pendingSurveillance);
    setModeGuardVisible(false);
    setShowModeModal(false);
  };

  const isModeChanged =
    pendingMode !== reelsControlMode ||
    pendingSurveillance.type !== reelsSurveillance.type ||
    pendingSurveillance.value !== reelsSurveillance.value;

  const modeLabel = CONTROL_MODES.find((m) => m.id === reelsControlMode);
  const activeCount = enabledReelsApps.length;

  const formatHour = (h: number): string =>
    `${h % 12 || 12}:00 ${h >= 12 ? "PM" : "AM"}`;

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
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold" style={{ color: t.textColor }}>
            Block Reels & Shorts
          </Text>
          <Pressable
            onPress={() => {
              setPendingMode(reelsControlMode);
              setPendingSurveillance(reelsSurveillance);
              setShowModeModal(true);
            }}
            className="flex-row items-center px-3 py-2 rounded-xl"
            style={{ backgroundColor: t.cardBgColor }}
          >
            <Ionicons
              name={
                (modeLabel?.icon ?? "happy-outline") as ComponentProps<
                  typeof Ionicons
                >["name"]
              }
              size={16}
              color={modeLabel?.color ?? "#10B981"}
            />
            <Text
              className="text-xs font-bold ml-1.5"
              style={{ color: modeLabel?.color ?? "#10B981" }}
            >
              {modeLabel?.title ?? "Flexible"}
            </Text>
          </Pressable>
        </View>
        <Text className="mb-6" style={{ color: t.mutedTextColor }}>
          {activeCount > 0
            ? `Blocking reels in ${activeCount} app${activeCount > 1 ? "s" : ""}`
            : "Toggle apps below to block their reels/shorts feed"}
        </Text>

        {/* Per-app toggles */}
        {REELS_APPS.map((app) => {
          const enabled = enabledReelsApps.includes(app.packageName);
          return (
            <Pressable
              key={app.packageName}
              onPress={() => {
                handleToggleApp(app.packageName);
              }}
              className="flex-row items-center p-4 rounded-xl mb-3"
              style={{
                backgroundColor: t.cardBgColor,
                borderWidth: 2,
                borderColor: enabled ? t.accentColor : "transparent",
              }}
            >
              <View
                className="w-10 h-10 rounded-lg items-center justify-center mr-4"
                style={{
                  backgroundColor: enabled
                    ? t.accentColor
                    : t.mutedTextColor + "1A",
                }}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={24}
                  color={enabled ? "white" : t.mutedTextColor}
                />
              </View>
              <View className="flex-1">
                <Text className="font-bold" style={{ color: t.textColor }}>
                  {app.name}
                </Text>
                <Text className="text-xs" style={{ color: t.mutedTextColor }}>
                  {enabled ? "Reels blocked" : "Tap to block reels"}
                </Text>
              </View>
              <View
                className="w-12 h-6 rounded-full px-1 justify-center"
                style={{
                  backgroundColor: enabled ? t.accentColor : "#9CA3AF",
                }}
              >
                <View
                  className={`w-4 h-4 rounded-full bg-white ${
                    enabled ? "self-end" : "self-start"
                  }`}
                />
              </View>
            </Pressable>
          );
        })}

        <View className="h-20" />
      </ScrollView>

      {/* Control Mode Modal */}
      <Modal visible={showModeModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 pt-20">
          <View
            className="flex-1 rounded-t-[40px] p-6"
            style={{ backgroundColor: t.bgColor }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className="text-xl font-bold"
                style={{ color: t.textColor }}
              >
                Reels Blocking Control
              </Text>
              <Pressable
                onPress={() => {
                  setShowModeModal(false);
                }}
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: t.cardBgColor }}
              >
                <Ionicons name="close" size={24} color={t.mutedTextColor} />
              </Pressable>
            </View>
            <Text className="text-sm mb-6" style={{ color: t.mutedTextColor }}>
              Controls friction for disabling reels blocking. Works under the
              main control mode.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {CONTROL_MODES.map((mode) => (
                <Pressable
                  key={mode.id}
                  onPress={() => {
                    handleSelectMode(mode.id);
                  }}
                  className="p-4 rounded-2xl mb-3"
                  style={{
                    borderWidth: 2,
                    backgroundColor:
                      pendingMode === mode.id
                        ? t.accentColor + "0D"
                        : t.cardBgColor,
                    borderColor:
                      pendingMode === mode.id ? t.accentColor : "transparent",
                  }}
                >
                  <View className="flex-row items-start">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: mode.color + "20" }}
                    >
                      <Ionicons
                        name={
                          mode.icon as ComponentProps<typeof Ionicons>["name"]
                        }
                        size={22}
                        color={mode.color}
                      />
                    </View>
                    <View className="flex-1 ml-3">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="text-base font-bold"
                          style={{ color: t.textColor }}
                        >
                          {mode.title}
                        </Text>
                        {pendingMode === mode.id && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={t.accentColor}
                          />
                        )}
                      </View>
                      <Text
                        className="text-sm mt-0.5"
                        style={{ color: t.mutedTextColor }}
                      >
                        {mode.description}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}

              {/* Friction Setup */}
              {(pendingMode === "locked" || pendingMode === "hardcore") && (
                <View className="mt-2 mb-4">
                  <View
                    className="rounded-2xl p-5"
                    style={{ backgroundColor: t.cardBgColor }}
                  >
                    <View className="flex-row gap-3 mb-6">
                      {(["timer", "click", "time"] as const).map((type) => (
                        <Pressable
                          key={type}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            setPendingSurveillance({
                              ...pendingSurveillance,
                              type,
                              ...(type === "time"
                                ? {
                                    startHour:
                                      pendingSurveillance.startHour ?? 9,
                                    endHour: pendingSurveillance.endHour ?? 21,
                                  }
                                : {}),
                            });
                          }}
                          className="flex-1 p-4 rounded-xl items-center"
                          style={{
                            borderWidth: 2,
                            backgroundColor:
                              pendingSurveillance.type === type
                                ? t.accentColor + "1A"
                                : t.bgColor,
                            borderColor:
                              pendingSurveillance.type === type
                                ? t.accentColor
                                : "transparent",
                          }}
                        >
                          <Ionicons
                            name={
                              (type === "timer"
                                ? "hourglass-outline"
                                : type === "click"
                                  ? "finger-print-outline"
                                  : "alarm-outline") as ComponentProps<
                                typeof Ionicons
                              >["name"]
                            }
                            size={24}
                            color={
                              pendingSurveillance.type === type
                                ? t.accentColor
                                : t.mutedTextColor
                            }
                          />
                          <Text
                            className="font-bold mt-1"
                            style={{
                              color:
                                pendingSurveillance.type === type
                                  ? t.accentColor
                                  : t.mutedTextColor,
                            }}
                          >
                            {type === "timer"
                              ? "Timer"
                              : type === "click"
                                ? "Clicks"
                                : "Time"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    {pendingSurveillance.type === "time" ? (
                      <View
                        className="p-4 rounded-xl"
                        style={{
                          backgroundColor: t.bgColor,
                          borderWidth: 1,
                          borderColor: t.mutedTextColor + "33",
                        }}
                      >
                        {[
                          {
                            label: "Start",
                            key: "startHour" as const,
                            def: 9,
                          },
                          { label: "End", key: "endHour" as const, def: 21 },
                        ].map(({ label, key, def }) => (
                          <View
                            key={key}
                            className="flex-row items-center justify-between mb-2"
                          >
                            <Text
                              className="font-bold"
                              style={{ color: t.mutedTextColor }}
                            >
                              {label}
                            </Text>
                            <View className="flex-row items-center gap-4">
                              <Pressable
                                onPress={() => {
                                  setPendingSurveillance({
                                    ...pendingSurveillance,
                                    [key]:
                                      ((pendingSurveillance[key] ?? def) -
                                        1 +
                                        24) %
                                      24,
                                  });
                                }}
                                className="w-10 h-10 rounded-full items-center justify-center"
                                style={{ backgroundColor: t.cardBgColor }}
                              >
                                <Ionicons
                                  name="remove"
                                  size={20}
                                  color="#EF4444"
                                />
                              </Pressable>
                              <Text
                                className="text-xl font-bold w-20 text-center"
                                style={{ color: t.textColor }}
                              >
                                {formatHour(pendingSurveillance[key] ?? def)}
                              </Text>
                              <Pressable
                                onPress={() => {
                                  setPendingSurveillance({
                                    ...pendingSurveillance,
                                    [key]:
                                      ((pendingSurveillance[key] ?? def) + 1) %
                                      24,
                                  });
                                }}
                                className="w-10 h-10 rounded-full items-center justify-center"
                                style={{ backgroundColor: t.cardBgColor }}
                              >
                                <Ionicons
                                  name="add"
                                  size={20}
                                  color="#EF4444"
                                />
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View
                        className="flex-row items-center justify-between p-4 rounded-xl"
                        style={{
                          backgroundColor: t.bgColor,
                          borderWidth: 1,
                          borderColor: t.mutedTextColor + "33",
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            const step =
                              pendingSurveillance.type === "timer" ? 5 : 10;
                            const min =
                              pendingSurveillance.type === "timer" ? 5 : 10;
                            setPendingSurveillance({
                              ...pendingSurveillance,
                              value: Math.max(
                                min,
                                pendingSurveillance.value - step,
                              ),
                            });
                          }}
                          className="w-12 h-12 rounded-full items-center justify-center"
                          style={{ backgroundColor: t.cardBgColor }}
                        >
                          <Ionicons
                            name="remove"
                            size={28}
                            color={t.accentColor}
                          />
                        </Pressable>
                        <View className="items-center">
                          <Text
                            className="text-3xl font-bold"
                            style={{ color: t.textColor }}
                          >
                            {pendingSurveillance.value}
                          </Text>
                          <Text
                            className="text-xs font-semibold uppercase"
                            style={{ color: t.mutedTextColor }}
                          >
                            {pendingSurveillance.type === "timer"
                              ? "Seconds"
                              : "Taps"}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            const step =
                              pendingSurveillance.type === "timer" ? 5 : 10;
                            setPendingSurveillance({
                              ...pendingSurveillance,
                              value: Math.min(
                                999,
                                pendingSurveillance.value + step,
                              ),
                            });
                          }}
                          className="w-12 h-12 rounded-full items-center justify-center"
                          style={{ backgroundColor: t.cardBgColor }}
                        >
                          <Ionicons
                            name="add"
                            size={28}
                            color={t.accentColor}
                          />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {isModeChanged && (
                <Pressable
                  onPress={handleSaveMode}
                  className="p-5 rounded-2xl items-center mt-2 mb-6"
                  style={{
                    backgroundColor: t.accentColor,
                    borderBottomWidth: 4,
                    borderBottomColor: t.accentColor,
                  }}
                >
                  <Text
                    className="font-bold text-lg"
                    style={{ color: t.textColor }}
                  >
                    {pendingMode === reelsControlMode
                      ? "Update Friction Settings"
                      : `Activate ${pendingMode.charAt(0).toUpperCase() + pendingMode.slice(1)} Mode`}
                  </Text>
                </Pressable>
              )}

              <View className="h-10" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Guard for disabling a reels app */}
      <InteractionGuard
        visible={guardVisible}
        actionName="Unblock Reels"
        surveillanceOverride={effectiveSurveillance}
        onSuccess={() => {
          if (pendingTogglePkg) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            toggleReelsApp(pendingTogglePkg);
          }
          setGuardVisible(false);
          setPendingTogglePkg(null);
        }}
        onCancel={() => {
          setGuardVisible(false);
          setPendingTogglePkg(null);
        }}
      />

      {/* Guard for changing control mode */}
      <InteractionGuard
        visible={modeGuardVisible}
        actionName="Change Reels Blocking Control Mode"
        surveillanceOverride={effectiveSurveillance}
        onSuccess={() => {
          applyMode();
        }}
        onCancel={() => {
          setModeGuardVisible(false);
        }}
      />
    </SafeAreaView>
  );
}
