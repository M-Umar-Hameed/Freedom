import { InteractionGuard } from "@/components/InteractionGuard";
import { useAppStore } from "@/stores/useAppStore";
import { useBlockingStore } from "@/stores/useBlockingStore";
import type { ControlMode, SurveillanceConfig } from "@/types/blocking";
import { getEffectiveMode, getEffectiveSurveillance } from "@/types/blocking";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Tab = "keywords" | "blocked" | "whitelisted";

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
    description: "No friction to remove blocked content.",
    icon: "happy-outline",
    color: "#10B981",
  },
  {
    id: "locked",
    title: "Locked",
    description: "Requires friction intervention to unblock content.",
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

export default function BlockWebsitesScreen(): ReactNode {
  const [activeTab, setActiveTab] = useState<Tab>("keywords");
  const [newValue, setNewValue] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    type: "add" | "remove" | "remove_multiple" | "remove_all" | "toggle";
    value?: string;
    tab: Tab;
  } | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [displayLimit, setDisplayLimit] = useState(50);
  const [showModeModal, setShowModeModal] = useState(false);

  const { controlMode, surveillance } = useAppStore();

  const {
    keywords,
    addKeyword: addStoreKeyword,
    removeKeyword,
    removeKeywords,
    includedUrls,
    excludedUrls,
    addIncludedUrl,
    removeIncludedUrl,
    toggleIncludedUrl,
    addExcludedUrl,
    removeExcludedUrl,
    toggleExcludedUrl,
    siteControlMode,
    setSiteControlMode,
    siteSurveillance,
    setSiteSurveillance,
  } = useBlockingStore();

  // Effective mode = stricter of main + sub
  const effectiveMode = getEffectiveMode(controlMode, siteControlMode);
  const effectiveSurveillance = getEffectiveSurveillance(
    controlMode,
    surveillance,
    siteControlMode,
    siteSurveillance,
  );

  // Local pending state for control mode modal
  const [pendingMode, setPendingMode] = useState<ControlMode>(siteControlMode);
  const [pendingSurveillance, setPendingSurveillance] =
    useState<SurveillanceConfig>(siteSurveillance);
  const [modeGuardVisible, setModeGuardVisible] = useState(false);

  const filteredKeywords = useMemo(() => {
    if (!searchQuery) return keywords;
    const lowerQuery = searchQuery.trim().toLowerCase();
    return keywords.filter((k) => k.includes(lowerQuery));
  }, [keywords, searchQuery]);

  const visibleKeywords = filteredKeywords.slice(0, displayLimit);

  const isEffectiveFlexible = effectiveMode === "flexible";

  // --- Actions ---

  const handleAddPress = (): void => {
    const trimmed = newValue.trim().toLowerCase();
    if (!trimmed) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeTab === "keywords") addStoreKeyword(trimmed);
    else if (activeTab === "blocked") addIncludedUrl(trimmed);
    else addExcludedUrl(trimmed);
    setNewValue("");
  };

  const handleRemovePress = (value: string): void => {
    if (isEffectiveFlexible) {
      performRemove(value);
    } else {
      setPendingAction({ type: "remove", value, tab: activeTab });
    }
  };

  const handleTogglePress = (url: string): void => {
    if (isEffectiveFlexible) {
      performToggle(url);
    } else {
      setPendingAction({ type: "toggle", value: url, tab: activeTab });
    }
  };

  const performRemove = (val?: string): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!val) return;
    if (activeTab === "keywords") removeKeyword(val);
    else if (activeTab === "blocked") removeIncludedUrl(val);
    else removeExcludedUrl(val);
    setPendingAction(null);
  };

  const performToggle = (url?: string): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!url) return;
    if (activeTab === "blocked") toggleIncludedUrl(url);
    else toggleExcludedUrl(url);
    setPendingAction(null);
  };

  const performRemoveMultiple = (all = false): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (all) removeKeywords(keywords);
    else removeKeywords(Array.from(selectedKeywords));
    setPendingAction(null);
    setSelectedKeywords(new Set());
    setIsSelectionMode(false);
  };

  const toggleSelection = (keyword: string): void => {
    const newSet = new Set(selectedKeywords);
    if (newSet.has(keyword)) newSet.delete(keyword);
    else newSet.add(keyword);
    setSelectedKeywords(newSet);
  };

  // --- Control Mode ---

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
    setSiteControlMode(pendingMode);
    setSiteSurveillance(pendingSurveillance);
    setModeGuardVisible(false);
    setShowModeModal(false);
  };

  const isModeChanged =
    pendingMode !== siteControlMode ||
    pendingSurveillance.type !== siteSurveillance.type ||
    pendingSurveillance.value !== siteSurveillance.value;

  const modeLabel = CONTROL_MODES.find((m) => m.id === siteControlMode);

  const formatHour = (h: number): string =>
    `${h % 12 || 12}:00 ${h >= 12 ? "PM" : "AM"}`;

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-freedom-primary"
      edges={["top"]}
    >
      <ScrollView
        className="flex-1 px-4 pt-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold text-black dark:text-white">
            Content Blocking
          </Text>
          <Pressable
            onPress={() => {
              setPendingMode(siteControlMode);
              setPendingSurveillance(siteSurveillance);
              setShowModeModal(true);
            }}
            className="flex-row items-center bg-gray-100 dark:bg-freedom-surface px-3 py-2 rounded-xl"
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
        <Text className="text-freedom-text-muted mb-6">
          Manage keywords, blocked and whitelisted websites
        </Text>

        {/* 3-Tab Switcher */}
        <View className="flex-row bg-gray-100 dark:bg-freedom-surface rounded-xl p-1 mb-6">
          {(
            [
              { id: "keywords", label: "Keywords", count: keywords.length },
              { id: "blocked", label: "Blocked", count: includedUrls.length },
              {
                id: "whitelisted",
                label: "Whitelist",
                count: excludedUrls.length,
              },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setActiveTab(tab.id);
                setNewValue("");
                if (tab.id !== "keywords") {
                  setIsSelectionMode(false);
                  setSelectedKeywords(new Set());
                }
              }}
              className={`flex-1 py-3 rounded-lg items-center ${
                activeTab === tab.id ? "bg-freedom-highlight" : "bg-transparent"
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-freedom-text-muted"
                }`}
              >
                {tab.label} ({tab.count})
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Add Input */}
        <View className="flex-row gap-2 mb-6">
          <TextInput
            className="flex-1 bg-gray-100 dark:bg-freedom-surface text-black dark:text-white px-4 py-3 rounded-xl"
            placeholder={
              activeTab === "keywords"
                ? "Enter keyword..."
                : "Enter domain (e.g. example.com)..."
            }
            placeholderTextColor="#94A3B8"
            value={newValue}
            onChangeText={setNewValue}
            onSubmitEditing={handleAddPress}
            autoCapitalize="none"
            keyboardType={activeTab === "keywords" ? "default" : "url"}
          />
          <Pressable
            onPress={handleAddPress}
            className="bg-freedom-highlight px-4 rounded-xl items-center justify-center"
          >
            <Ionicons name="add-circle-outline" size={24} color="white" />
          </Pressable>
        </View>

        {/* Keywords Tab */}
        {activeTab === "keywords" && (
          <>
            {keywords.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-4">
                  {!isSelectionMode ? (
                    <>
                      <Text className="text-xl font-bold text-black dark:text-white">
                        Directory
                      </Text>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => {
                            setIsSelectionMode(true);
                          }}
                          className="bg-freedom-highlight px-4 py-2 rounded-lg active:opacity-70"
                        >
                          <Text className="text-white font-bold tracking-wide">
                            Select
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            if (isEffectiveFlexible)
                              performRemoveMultiple(true);
                            else
                              setPendingAction({
                                type: "remove_all",
                                tab: "keywords",
                              });
                          }}
                          className="bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-lg"
                        >
                          <Text className="text-red-600 dark:text-red-400 font-medium">
                            Delete All
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text className="text-lg font-bold text-black dark:text-white">
                        {selectedKeywords.size} Selected
                      </Text>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => {
                            if (
                              selectedKeywords.size === filteredKeywords.length
                            )
                              setSelectedKeywords(new Set());
                            else setSelectedKeywords(new Set(filteredKeywords));
                          }}
                          className="bg-freedom-highlight/20 dark:bg-freedom-highlight/30 px-3 py-2 rounded-lg border border-freedom-highlight/40 active:opacity-70"
                        >
                          <Text className="text-freedom-highlight font-bold">
                            {selectedKeywords.size === filteredKeywords.length
                              ? "Deselect"
                              : "Select All"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            if (isEffectiveFlexible)
                              performRemoveMultiple(false);
                            else
                              setPendingAction({
                                type: "remove_multiple",
                                tab: "keywords",
                              });
                          }}
                          className={`px-3 py-2 rounded-lg ${selectedKeywords.size > 0 ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"}`}
                          disabled={selectedKeywords.size === 0}
                        >
                          <Text className="text-white font-medium">Delete</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setIsSelectionMode(false);
                            setSelectedKeywords(new Set());
                          }}
                          className="bg-gray-200 dark:bg-gray-800 px-3 py-2 rounded-lg active:opacity-70"
                        >
                          <Text className="text-gray-700 dark:text-gray-300 font-bold">
                            Cancel
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>

                <TextInput
                  className="bg-gray-100 dark:bg-freedom-surface text-black dark:text-white px-4 py-3 rounded-xl border border-gray-200 dark:border-freedom-surface"
                  placeholder="Search existing keywords..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    setDisplayLimit(50);
                  }}
                />
              </View>
            )}

            {keywords.length === 0 ? (
              <View className="bg-gray-100 dark:bg-freedom-surface rounded-xl p-8 items-center">
                <Ionicons name="text-outline" size={48} color="#94A3B8" />
                <Text className="text-freedom-text-muted mt-4 text-center">
                  No keywords added yet. Add keywords that should trigger
                  content blocking.
                </Text>
              </View>
            ) : (
              <View className="flex-col pb-10">
                <Text className="text-freedom-text-muted mb-3 text-xs">
                  {filteredKeywords.length} keywords total{" "}
                  {searchQuery ? "found" : ""}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {visibleKeywords.map((keyword) => (
                    <Pressable
                      key={keyword}
                      onPress={() => {
                        if (isSelectionMode) toggleSelection(keyword);
                        else handleRemovePress(keyword);
                      }}
                      className={`flex-row items-center px-3 py-2 rounded-lg active:opacity-50 ${isSelectionMode && selectedKeywords.has(keyword) ? "bg-freedom-highlight/20 border border-freedom-highlight" : "bg-gray-100 dark:bg-freedom-surface border border-transparent"}`}
                    >
                      {isSelectionMode && (
                        <Ionicons
                          name={
                            selectedKeywords.has(keyword)
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={18}
                          color={
                            selectedKeywords.has(keyword)
                              ? "#3B82F6"
                              : "#94A3B8"
                          }
                          style={{ marginRight: 6 }}
                        />
                      )}
                      <Text className="text-black dark:text-white mr-2">
                        {keyword}
                      </Text>
                      {!isSelectionMode && (
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color="#EF4444"
                        />
                      )}
                    </Pressable>
                  ))}
                </View>

                {filteredKeywords.length > displayLimit && (
                  <Pressable
                    onPress={() => {
                      setDisplayLimit((prev) => prev + 100);
                    }}
                    className="mt-6 py-3 px-6 bg-gray-100 dark:bg-freedom-surface rounded-xl items-center self-center"
                  >
                    <Text className="text-freedom-highlight font-bold">
                      Load More ({filteredKeywords.length - displayLimit}{" "}
                      remain)
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}

        {/* Blocked / Whitelisted Tab — with toggles */}
        {(activeTab === "blocked" || activeTab === "whitelisted") && (
          <>
            {(activeTab === "blocked" ? includedUrls : excludedUrls).length ===
            0 ? (
              <View className="bg-gray-100 dark:bg-freedom-surface rounded-xl p-8 items-center">
                <Ionicons name="globe-outline" size={48} color="#94A3B8" />
                <Text className="text-freedom-text-muted mt-4 text-center">
                  {activeTab === "blocked"
                    ? "No blocked websites. Add domains to block."
                    : "No whitelisted websites. Add domains to exclude from blocking."}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {(activeTab === "blocked" ? includedUrls : excludedUrls).map(
                  (entry) => (
                    <View
                      key={entry.url}
                      className={`bg-gray-100 dark:bg-freedom-surface flex-row items-center justify-between px-4 py-3 rounded-xl ${!entry.enabled ? "opacity-50" : ""}`}
                    >
                      <View className="flex-row items-center flex-1">
                        <Ionicons
                          name={
                            activeTab === "blocked"
                              ? "ban-outline"
                              : "checkmark-done-outline"
                          }
                          size={20}
                          color={
                            activeTab === "blocked" ? "#EF4444" : "#2DD4BF"
                          }
                        />
                        <Text className="text-black dark:text-white ml-3 flex-1">
                          {entry.url}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-x-2">
                        {/* Toggle */}
                        <Pressable
                          onPress={() => {
                            handleTogglePress(entry.url);
                          }}
                          className={`w-12 h-6 rounded-full px-1 justify-center ${
                            entry.enabled
                              ? "bg-freedom-highlight"
                              : "bg-gray-400"
                          }`}
                        >
                          <View
                            className={`w-4 h-4 rounded-full bg-white ${
                              entry.enabled ? "self-end" : "self-start"
                            }`}
                          />
                        </Pressable>
                        {/* Delete */}
                        <Pressable
                          onPress={() => {
                            handleRemovePress(entry.url);
                          }}
                          className="active:opacity-50 p-1"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#94A3B8"
                          />
                        </Pressable>
                      </View>
                    </View>
                  ),
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Control Mode Modal */}
      <Modal visible={showModeModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 pt-20">
          <View className="flex-1 bg-white dark:bg-freedom-primary rounded-t-[40px] p-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-black dark:text-white">
                Content Control Mode
              </Text>
              <Pressable
                onPress={() => {
                  setShowModeModal(false);
                }}
                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-freedom-surface items-center justify-center"
              >
                <Ionicons name="close" size={24} color="#94A3B8" />
              </Pressable>
            </View>
            <Text className="text-freedom-text-muted text-sm mb-6">
              Controls friction for keyword and website changes. Works under the
              main control mode.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {CONTROL_MODES.map((mode) => (
                <Pressable
                  key={mode.id}
                  onPress={() => {
                    handleSelectMode(mode.id);
                  }}
                  className={`p-4 rounded-2xl mb-3 border-2 ${
                    pendingMode === mode.id
                      ? "bg-freedom-highlight/5 border-freedom-highlight"
                      : "bg-gray-100 dark:bg-freedom-surface border-transparent"
                  }`}
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
                        <Text className="text-base font-bold text-black dark:text-white">
                          {mode.title}
                        </Text>
                        {pendingMode === mode.id && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color="#2DD4BF"
                          />
                        )}
                      </View>
                      <Text className="text-freedom-text-muted text-sm mt-0.5">
                        {mode.description}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}

              {/* Friction Setup */}
              {(pendingMode === "locked" || pendingMode === "hardcore") && (
                <View className="mt-2 mb-4">
                  <View className="flex-row items-center mb-3 px-1">
                    <Ionicons
                      name="settings-outline"
                      size={18}
                      color="#2DD4BF"
                    />
                    <Text className="text-sm font-bold text-freedom-highlight uppercase ml-2">
                      Friction Setup
                    </Text>
                  </View>
                  <View className="bg-gray-100 dark:bg-freedom-surface rounded-2xl p-5">
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
                          className={`flex-1 p-4 rounded-xl items-center border-2 ${
                            pendingSurveillance.type === type
                              ? "bg-freedom-highlight/10 border-freedom-highlight"
                              : "bg-white dark:bg-freedom-primary border-transparent"
                          }`}
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
                                ? "#2DD4BF"
                                : "#94A3B8"
                            }
                          />
                          <Text
                            className={`font-bold mt-1 ${
                              pendingSurveillance.type === type
                                ? "text-freedom-highlight"
                                : "text-freedom-text-muted"
                            }`}
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
                      <View className="bg-white dark:bg-freedom-primary p-4 rounded-xl border border-gray-200 dark:border-freedom-secondary">
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
                            <Text className="text-freedom-text-muted font-bold">
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
                                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-freedom-surface items-center justify-center"
                              >
                                <Ionicons
                                  name="remove"
                                  size={20}
                                  color="#EF4444"
                                />
                              </Pressable>
                              <Text className="text-xl font-bold text-black dark:text-white w-20 text-center">
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
                                className="w-10 h-10 rounded-full bg-gray-100 dark:bg-freedom-surface items-center justify-center"
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
                      <View className="flex-row items-center justify-between bg-white dark:bg-freedom-primary p-4 rounded-xl border border-gray-200 dark:border-freedom-secondary">
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
                          className="w-12 h-12 rounded-full bg-gray-100 dark:bg-freedom-surface items-center justify-center"
                        >
                          <Ionicons name="remove" size={28} color="#2DD4BF" />
                        </Pressable>
                        <View className="items-center">
                          <Text className="text-3xl font-bold text-black dark:text-white">
                            {pendingSurveillance.value}
                          </Text>
                          <Text className="text-freedom-text-muted text-xs font-semibold uppercase">
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
                          className="w-12 h-12 rounded-full bg-gray-100 dark:bg-freedom-surface items-center justify-center"
                        >
                          <Ionicons name="add" size={28} color="#2DD4BF" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {isModeChanged && (
                <Pressable
                  onPress={handleSaveMode}
                  className="bg-freedom-highlight p-5 rounded-2xl items-center mt-2 mb-6 border-b-4 border-freedom-accent"
                >
                  <Text className="text-white font-bold text-lg">
                    {pendingMode === siteControlMode
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

      {/* Guard for content changes */}
      <InteractionGuard
        visible={!!pendingAction}
        actionName={
          pendingAction?.type === "remove_all"
            ? "Delete All Keywords"
            : pendingAction?.type === "remove_multiple"
              ? `Delete ${selectedKeywords.size} Keywords`
              : pendingAction?.type === "toggle"
                ? "Toggle Website"
                : pendingAction?.tab === "blocked"
                  ? "Unblock Website"
                  : pendingAction?.tab === "whitelisted"
                    ? "Un-whitelist Website"
                    : "Remove Keyword"
        }
        surveillanceOverride={effectiveSurveillance}
        onSuccess={() => {
          if (pendingAction?.type === "remove" && pendingAction.value)
            performRemove(pendingAction.value);
          else if (pendingAction?.type === "toggle" && pendingAction.value)
            performToggle(pendingAction.value);
          else if (pendingAction?.type === "remove_multiple")
            performRemoveMultiple(false);
          else if (pendingAction?.type === "remove_all")
            performRemoveMultiple(true);
        }}
        onCancel={() => {
          setPendingAction(null);
        }}
      />

      {/* Guard for changing control mode */}
      <InteractionGuard
        visible={modeGuardVisible}
        actionName="Change Content Control Mode"
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
