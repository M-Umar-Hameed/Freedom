import { InteractionGuard } from "@/components/InteractionGuard";
import { useAppTheme } from "@/providers/ThemeProvider";
import { BlocklistService } from "@/services/BlocklistService";
import { useAppStore } from "@/stores/useAppStore";
import { useBlockingStore } from "@/stores/useBlockingStore";
import { getEffectiveMode, getEffectiveSurveillance } from "@/types/blocking";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function UpdateSourcesScreen(): React.ReactNode {
  const router = useRouter();
  const t = useAppTheme();
  const {
    sources,
    addSource,
    removeSource,
    toggleSource,
    adultControlMode,
    adultSurveillance,
  } = useBlockingStore();
  const { controlMode, surveillance } = useAppStore();

  const effectiveMode = getEffectiveMode(controlMode, adultControlMode);
  const effectiveSurveillance = getEffectiveSurveillance(
    controlMode,
    surveillance,
    adultControlMode,
    adultSurveillance,
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newFormat, setNewFormat] = useState<"domains" | "hosts" | "keywords">(
    "domains",
  );

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({
    current: 0,
    total: 0,
    name: "",
  });

  const [guardVisible, setGuardVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "remove" | "toggle";
    id: string;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  }>({ visible: false, title: "", message: "", type: "success" });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error",
  ): void => {
    setAlertModal({ visible: true, title, message, type });
  };

  const handleAddSource = (): void => {
    if (!newName || !newUrl) {
      showAlert("Error", "Please fill in both name and URL.", "error");
      return;
    }
    if (!newUrl.startsWith("http")) {
      showAlert("Error", "URL must start with http:// or https://", "error");
      return;
    }

    addSource({
      name: newName,
      url: newUrl,
      format: newFormat,
      enabled: true,
    });
    setNewName("");
    setNewUrl("");
    setIsAdding(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemovePress = (id: string): void => {
    if (effectiveMode === "flexible") {
      executeAction("remove", id);
    } else {
      setPendingAction({ type: "remove", id });
      setGuardVisible(true);
    }
  };

  const handleTogglePress = (id: string, isEnabling: boolean): void => {
    if (effectiveMode === "flexible" || isEnabling) {
      executeAction("toggle", id);
    } else {
      setPendingAction({ type: "toggle", id });
      setGuardVisible(true);
    }
  };

  const executeAction = (type: "remove" | "toggle", id: string): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === "remove") removeSource(id);
    else toggleSource(id);
    setGuardVisible(false);
    setPendingAction(null);
  };

  const handleUpdateAll = async (): Promise<void> => {
    const enabledCount = sources.filter((s) => s.enabled).length;
    if (enabledCount === 0) {
      showAlert("Error", "No enabled sources to update.", "error");
      return;
    }

    setIsUpdating(true);
    const success = await BlocklistService.updateBlocklists(
      (current, total, name) => {
        setUpdateProgress({ current, total, name });
      },
    );
    setIsUpdating(false);

    if (success) {
      showAlert(
        "Sources Updated",
        "All blocklists have been fetched and synced to native services.",
        "success",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      showAlert(
        "Update Failed",
        "Failed to update some sources. Check your internet connection.",
        "error",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.bgColor }}>
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-2"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: t.mutedTextColor + "33",
        }}
      >
        <Pressable
          onPress={() => {
            router.back();
          }}
          className="p-2 -ml-2"
        >
          <Ionicons name="chevron-back" size={24} color={t.accentColor} />
        </Pressable>
        <Text className="text-xl font-bold ml-2" style={{ color: t.textColor }}>
          Update Sources
        </Text>
        <View className="flex-1" />
        <Pressable
          onPress={() => {
            setIsAdding(true);
          }}
          className="p-2 rounded-full"
          style={{ backgroundColor: t.accentColor + "1A" }}
        >
          <Ionicons name="add" size={24} color={t.accentColor} />
        </Pressable>
      </View>

      <View className="flex-1 p-4">
        <Text className="mb-4" style={{ color: t.mutedTextColor }}>
          Manage blocklist URLs. Enabled sources will be fetched and synced when
          you tap &quot;Update &amp; Sync&quot;.
        </Text>

        <FlatList
          data={sources}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              className="p-4 rounded-xl mb-3 flex-row items-center"
              style={{ backgroundColor: t.cardBgColor }}
            >
              <View className="flex-1">
                <Text className="font-semibold" style={{ color: t.textColor }}>
                  {item.name}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: t.mutedTextColor }}
                  numberOfLines={1}
                >
                  {item.url}
                </Text>
                <View className="flex-row mt-2">
                  <View
                    className="px-2 py-0.5 rounded"
                    style={{ backgroundColor: t.accentColor + "33" }}
                  >
                    <Text
                      className="text-[10px] uppercase font-bold"
                      style={{ color: t.accentColor }}
                    >
                      {item.format}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="flex-row items-center ml-2">
                <Pressable
                  onPress={() => {
                    handleTogglePress(item.id, !item.enabled);
                  }}
                  className="p-2"
                >
                  <Ionicons
                    name={item.enabled ? "eye" : "eye-off"}
                    size={20}
                    color={item.enabled ? t.accentColor : t.mutedTextColor}
                  />
                </Pressable>
                <Pressable
                  onPress={() => {
                    handleRemovePress(item.id);
                  }}
                  className="p-2"
                >
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>

      <View
        className="p-4"
        style={{ borderTopWidth: 1, borderTopColor: t.mutedTextColor + "33" }}
      >
        <Pressable
          onPress={() => {
            void handleUpdateAll();
          }}
          disabled={isUpdating}
          className="p-4 rounded-xl flex-row justify-center items-center"
          style={{ backgroundColor: t.accentColor }}
        >
          {isUpdating ? (
            <ActivityIndicator
              color={t.bgColor}
              size="small"
              className="mr-2"
            />
          ) : (
            <Ionicons
              name="refresh"
              size={20}
              color={t.bgColor}
              className="mr-2"
            />
          )}
          <Text className="font-bold text-center" style={{ color: t.bgColor }}>
            {isUpdating ? "Updating..." : "Update & Sync All"}
          </Text>
        </Pressable>
      </View>

      {/* Add Source Modal */}
      <Modal visible={isAdding} animationType="fade" transparent>
        <View className="flex-1 bg-black/50 justify-center p-6">
          <View
            className="p-6 rounded-2xl"
            style={{ backgroundColor: t.cardBgColor }}
          >
            <Text
              className="text-xl font-bold mb-4"
              style={{ color: t.textColor }}
            >
              Add New Source
            </Text>

            <Text className="mb-1 text-sm" style={{ color: t.mutedTextColor }}>
              Source Name
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. My Blocklist"
              placeholderTextColor={t.mutedTextColor}
              className="p-3 rounded-lg mb-4"
              style={{ backgroundColor: t.bgColor, color: t.textColor }}
            />

            <Text className="mb-1 text-sm" style={{ color: t.mutedTextColor }}>
              URL (Text file)
            </Text>
            <TextInput
              value={newUrl}
              onChangeText={setNewUrl}
              placeholder="https://example.com/blocklist.txt"
              placeholderTextColor={t.mutedTextColor}
              autoCapitalize="none"
              keyboardType="url"
              className="p-3 rounded-lg mb-4"
              style={{ backgroundColor: t.bgColor, color: t.textColor }}
            />

            <Text className="mb-2 text-sm" style={{ color: t.mutedTextColor }}>
              Format
            </Text>
            <View className="flex-row mb-6">
              <Pressable
                onPress={() => {
                  setNewFormat("domains");
                }}
                className="flex-1 p-3 rounded-lg mr-1 border"
                style={{
                  backgroundColor:
                    newFormat === "domains" ? t.accentColor : undefined,
                  borderColor:
                    newFormat === "domains"
                      ? t.accentColor
                      : t.mutedTextColor + "33",
                }}
              >
                <Text
                  className="text-center font-semibold text-xs"
                  style={{
                    color:
                      newFormat === "domains" ? t.bgColor : t.mutedTextColor,
                  }}
                >
                  Domains
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNewFormat("hosts");
                }}
                className="flex-1 p-3 rounded-lg mx-1 border"
                style={{
                  backgroundColor:
                    newFormat === "hosts" ? t.accentColor : undefined,
                  borderColor:
                    newFormat === "hosts"
                      ? t.accentColor
                      : t.mutedTextColor + "33",
                }}
              >
                <Text
                  className="text-center font-semibold text-xs"
                  style={{
                    color: newFormat === "hosts" ? t.bgColor : t.mutedTextColor,
                  }}
                >
                  Hosts
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNewFormat("keywords");
                }}
                className="flex-1 p-3 rounded-lg ml-1 border"
                style={{
                  backgroundColor:
                    newFormat === "keywords" ? t.accentColor : undefined,
                  borderColor:
                    newFormat === "keywords"
                      ? t.accentColor
                      : t.mutedTextColor + "33",
                }}
              >
                <Text
                  className="text-center font-semibold text-xs"
                  style={{
                    color:
                      newFormat === "keywords" ? t.bgColor : t.mutedTextColor,
                  }}
                >
                  Keywords
                </Text>
              </Pressable>
            </View>

            <View className="flex-row">
              <Pressable
                onPress={() => {
                  setIsAdding(false);
                }}
                className="flex-1 p-3 rounded-xl border mr-2"
                style={{ borderColor: t.mutedTextColor + "33" }}
              >
                <Text className="text-center" style={{ color: t.textColor }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  handleAddSource();
                }}
                className="flex-1 p-3 rounded-xl"
                style={{ backgroundColor: t.accentColor }}
              >
                <Text
                  className="text-center font-bold"
                  style={{ color: t.bgColor }}
                >
                  Add Source
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Themed Alert Modal */}
      <Modal visible={alertModal.visible} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View
            className="w-full rounded-3xl p-6 items-center border"
            style={{
              backgroundColor: t.cardBgColor,
              borderColor: t.accentColor + "33",
            }}
          >
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{
                backgroundColor:
                  alertModal.type === "success"
                    ? t.successColor + "33"
                    : t.dangerColor + "33",
              }}
            >
              <Ionicons
                name={
                  alertModal.type === "success"
                    ? "checkmark-circle"
                    : "alert-circle"
                }
                size={36}
                color={alertModal.type === "success" ? "#10B981" : "#EF4444"}
              />
            </View>
            <Text
              className="text-xl font-bold text-center mb-2"
              style={{ color: t.textColor }}
            >
              {alertModal.title}
            </Text>
            <Text
              className="text-center mb-6"
              style={{ color: t.mutedTextColor }}
            >
              {alertModal.message}
            </Text>
            <Pressable
              onPress={() => {
                setAlertModal((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full py-4 rounded-xl items-center"
              style={{
                backgroundColor:
                  alertModal.type === "success" ? t.accentColor : t.dangerColor,
              }}
            >
              <Text
                className="font-bold text-lg"
                style={{ color: t.textColor }}
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Progress Modal */}
      {isUpdating && (
        <View className="absolute inset-0 bg-black/30 justify-center items-center pointer-events-none">
          <View
            className="p-6 rounded-2xl w-2/3 items-center shadow-xl"
            style={{ backgroundColor: t.cardBgColor }}
          >
            <ActivityIndicator color={t.accentColor} size="large" />
            <Text
              className="font-bold mt-4 text-center"
              style={{ color: t.textColor }}
            >
              Fetching Sources
            </Text>
            <Text
              className="text-xs mt-1 text-center"
              style={{ color: t.mutedTextColor }}
            >
              {updateProgress.name}
            </Text>
            <View
              className="w-full h-2 rounded-full mt-4 overflow-hidden"
              style={{ backgroundColor: t.mutedTextColor + "33" }}
            >
              <View
                className="h-full"
                style={{
                  backgroundColor: t.accentColor,
                  width: `${(updateProgress.current / (updateProgress.total || 1)) * 100}%`,
                }}
              />
            </View>
            <Text
              className="text-[10px] mt-2"
              style={{ color: t.mutedTextColor }}
            >
              {updateProgress.current} / {updateProgress.total}
            </Text>
          </View>
        </View>
      )}

      {/* Interaction Guard */}
      <InteractionGuard
        visible={guardVisible}
        actionName={
          pendingAction?.type === "remove"
            ? "Remove Blocklist Source"
            : "Disable Blocklist Source"
        }
        surveillanceOverride={effectiveSurveillance}
        onSuccess={() => {
          if (pendingAction) {
            executeAction(pendingAction.type, pendingAction.id);
          }
        }}
        onCancel={() => {
          setGuardVisible(false);
          setPendingAction(null);
        }}
      />
    </SafeAreaView>
  );
}
