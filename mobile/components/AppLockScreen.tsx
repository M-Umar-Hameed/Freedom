import { useAppTheme } from "@/providers/ThemeProvider";
import { useAppStore } from "@/stores/useAppStore";
import * as Crypto from "expo-crypto";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

export function AppLockScreen({
  visible,
  onUnlock,
}: {
  visible: boolean;
  onUnlock: () => void;
}): ReactNode {
  const t = useAppTheme();
  const { appLockType, appLockHash } = useAppStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const attemptBiometric = useCallback(async (): Promise<void> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock LibreAscent",
      fallbackLabel: "Use password",
      disableDeviceFallback: true,
    });
    if (result.success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUnlock();
    }
  }, [onUnlock]);

  useEffect(() => {
    if (visible && appLockType === "passkey") {
      void attemptBiometric();
    }
  }, [visible, appLockType, attemptBiometric]);

  const handlePasswordSubmit = async (): Promise<void> => {
    if (!password.trim()) return;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password,
    );
    if (hash === appLockHash) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPassword("");
      setError("");
      onUnlock();
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Incorrect password");
      setPassword("");
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: t.bgColor }}
      >
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: t.accentColor + "33" }}
        >
          <Ionicons name="lock-closed" size={40} color={t.accentColor} />
        </View>
        <Text
          className="text-2xl font-bold mb-2"
          style={{ color: t.textColor }}
        >
          LibreAscent is Locked
        </Text>
        <Text className="text-center mb-8" style={{ color: t.mutedTextColor }}>
          {appLockType === "passkey"
            ? "Authenticate with your fingerprint to continue"
            : "Enter your password to continue"}
        </Text>

        {appLockType === "passkey" ? (
          <Pressable
            onPress={() => {
              void attemptBiometric();
            }}
            className="border-2 p-5 rounded-2xl items-center w-full"
            style={{
              backgroundColor: t.accentColor + "1A",
              borderColor: t.accentColor,
            }}
          >
            <Ionicons name="finger-print" size={48} color={t.accentColor} />
            <Text className="font-bold mt-3" style={{ color: t.accentColor }}>
              Tap to Authenticate
            </Text>
          </Pressable>
        ) : (
          <View className="w-full">
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError("");
              }}
              placeholder="Enter password"
              placeholderTextColor="#64748B"
              secureTextEntry
              autoFocus
              onSubmitEditing={() => {
                void handlePasswordSubmit();
              }}
              className="border-2 p-4 rounded-xl text-center text-lg mb-4"
              style={{
                backgroundColor: t.cardBgColor,
                borderColor: t.mutedTextColor + "33",
                color: t.textColor,
              }}
            />
            {error ? (
              <Text
                className="text-center mb-4"
                style={{ color: t.dangerColor }}
              >
                {error}
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                void handlePasswordSubmit();
              }}
              className="p-4 rounded-xl items-center"
              style={{ backgroundColor: t.accentColor }}
            >
              <Text
                className="font-bold text-lg"
                style={{ color: t.textColor }}
              >
                Unlock
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
