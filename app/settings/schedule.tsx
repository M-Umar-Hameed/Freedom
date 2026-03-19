import { InteractionGuard } from "@/components/InteractionGuard";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useAppStore } from "@/stores/useAppStore";
import type { ScheduleEntry } from "@/types/blocking";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScheduleScreen(): ReactNode {
  const router = useRouter();
  const t = useAppTheme();
  const { schedule, setSchedule, controlMode } = useAppStore();
  const [pendingDay, setPendingDay] = useState<number | null>(null);

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const handleTogglePress = (dayIndex: number, isEnabling: boolean): void => {
    if (controlMode === "flexible" || isEnabling) {
      toggleDay(dayIndex);
    } else {
      setPendingDay(dayIndex);
    }
  };

  const toggleDay = (dayIndex: number): void => {
    void Haptics.selectionAsync();
    const existing = schedule.find((s) => s.day === dayIndex);
    if (existing) {
      setSchedule(
        schedule.map((s) =>
          s.day === dayIndex ? { ...s, enabled: !s.enabled } : s,
        ),
      );
    } else {
      const newEntry: ScheduleEntry = {
        id: Math.random().toString(36).substring(7),
        day: dayIndex,
        startTime: "09:00",
        endTime: "21:00",
        enabled: true,
      };
      setSchedule([...schedule, newEntry]);
    }
    setPendingDay(null);
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: t.bgColor }}
      edges={["top"]}
    >
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => {
            router.back();
          }}
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color={t.accentColor} />
        </Pressable>
        <Text className="text-xl font-bold ml-2" style={{ color: t.textColor }}>
          Schedule
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="mb-6" style={{ color: t.mutedTextColor }}>
          Set specific times for protection. If no schedule is set, protection
          is always active.
        </Text>

        <View
          className="rounded-2xl overflow-hidden mb-6"
          style={{ backgroundColor: t.cardBgColor }}
        >
          {days.map((day, index) => {
            const entry = schedule.find((s) => s.day === index);
            return (
              <View
                key={day}
                className="p-4"
                style={
                  index !== days.length - 1
                    ? {
                        borderBottomWidth: 1,
                        borderBottomColor: t.mutedTextColor + "33",
                      }
                    : undefined
                }
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-lg font-semibold"
                    style={{ color: t.textColor }}
                  >
                    {day}
                  </Text>
                  <Switch
                    value={entry?.enabled || false}
                    onValueChange={(val) => {
                      handleTogglePress(index, val);
                    }}
                    trackColor={{ false: "#ccc", true: t.accentColor }}
                    thumbColor={entry?.enabled ? "#fff" : "#999"}
                  />
                </View>

                {entry?.enabled && (
                  <View className="flex-row items-center mt-3 gap-4">
                    <View
                      className="flex-1 p-2 rounded-lg items-center border"
                      style={{
                        backgroundColor: t.bgColor,
                        borderColor: t.mutedTextColor + "33",
                      }}
                    >
                      <Text
                        className="text-xs uppercase mb-1"
                        style={{ color: t.mutedTextColor }}
                      >
                        Start
                      </Text>
                      <Text
                        className="font-bold"
                        style={{ color: t.textColor }}
                      >
                        {entry.startTime}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={t.mutedTextColor}
                    />
                    <View
                      className="flex-1 p-2 rounded-lg items-center border"
                      style={{
                        backgroundColor: t.bgColor,
                        borderColor: t.mutedTextColor + "33",
                      }}
                    >
                      <Text
                        className="text-xs uppercase mb-1"
                        style={{ color: t.mutedTextColor }}
                      >
                        End
                      </Text>
                      <Text
                        className="font-bold"
                        style={{ color: t.textColor }}
                      >
                        {entry.endTime}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View
          className="p-4 rounded-xl"
          style={{ backgroundColor: t.accentColor + "1A" }}
        >
          <View className="flex-row items-center mb-2">
            <Ionicons name="bulb" size={20} color={t.accentColor} />
            <Text className="ml-2 font-bold" style={{ color: t.accentColor }}>
              Tip
            </Text>
          </View>
          <Text className="text-sm leading-5" style={{ color: t.textColor }}>
            Overnight schedules (e.g., 10 PM to 6 AM) are fully supported. Use
            schedules to build a routine that works for you.
          </Text>
        </View>

        <View className="h-20" />
      </ScrollView>

      <InteractionGuard
        visible={pendingDay !== null}
        actionName="Change Protection Schedule"
        onSuccess={() => {
          if (pendingDay !== null) toggleDay(pendingDay);
        }}
        onCancel={() => {
          setPendingDay(null);
        }}
      />
    </SafeAreaView>
  );
}
