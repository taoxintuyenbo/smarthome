import { useHomeAssistant } from "@/contexts/HomeAssistantContext";
import { HomeStorage } from "@/utils/homeStorage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface AddHomeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddHomeModal({
  visible,
  onClose,
  onSuccess,
}: AddHomeModalProps) {
  const [ip, setIp] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { reconnect } = useHomeAssistant();

  // Load existing config when modal opens
  useEffect(() => {
    if (visible) {
      loadExistingConfig();
    }
  }, [visible]);

  const loadExistingConfig = async () => {
    try {
      const config = await HomeStorage.getHAConfig();
      setIp(config.ip);
      setToken(config.token);
    } catch (error) {
      console.error("Error loading config:", error);
    }
  };

  const validateIP = (ipAddress: string): boolean => {
    // Allow IP:PORT or just IP format
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
    return ipPattern.test(ipAddress);
  };

  const handleSave = async () => {
    const trimmedIp = ip.trim();
    const trimmedToken = token.trim();

    if (!trimmedIp || !trimmedToken) {
      Alert.alert("Validation Error", "Please fill in both IP and token");
      return;
    }

    if (!validateIP(trimmedIp)) {
      Alert.alert(
        "Invalid IP",
        "Please enter a valid IP address (e.g., 192.168.1.12:8123)"
      );
      return;
    }

    setIsLoading(true);
    try {
      await HomeStorage.saveHAConfig({
        ip: trimmedIp,
        token: trimmedToken,
      });

      // Trigger reconnection with new config
      console.log("🔄 Reconnecting with new configuration...");
      await reconnect();

      Alert.alert(
        "Success",
        "Home Assistant configuration saved and connected successfully"
      );

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving config:", error);
      Alert.alert("Error", "Failed to save configuration. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Don't reset fields on close so user can see what's saved
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <View className="h-[70%] rounded-t-[32px] bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
              <TouchableOpacity
                onPress={handleClose}
                className="h-10 w-10 items-center justify-center"
              >
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-900">
                Setup Home Assistant
              </Text>
              <View className="h-10 w-10" />
            </View>

            {/* Scrollable Content */}
            <ScrollView
              className="flex-1 bg-gray-50"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="px-6 py-6">
                {/* Info Banner */}
                <View className="mb-6 flex-row gap-3 rounded-2xl bg-blue-50 px-4 py-4">
                  <Ionicons
                    name="information-circle"
                    size={24}
                    color="#3B82F6"
                  />
                  <View className="flex-1">
                    <Text className="mb-1 text-sm font-semibold text-blue-900">
                      Home Assistant Connection
                    </Text>
                    <Text className="text-xs text-blue-700">
                      Enter your Home Assistant IP address and access token to
                      connect. This will reconnect immediately after saving.
                    </Text>
                  </View>
                </View>

                {/* IP Address Input */}
                <View className="mb-5">
                  <Text className="mb-2 text-sm font-semibold text-gray-700">
                    IP Address <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
                    <Ionicons name="globe-outline" size={24} color="#6B7280" />
                    <TextInput
                      className="flex-1 text-base text-gray-900"
                      placeholder="192.168.1.12:8123"
                      placeholderTextColor="#9CA3AF"
                      value={ip}
                      onChangeText={setIp}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>
                  <Text className="mt-1 text-xs text-gray-500">
                    Format: IP:PORT (e.g., 192.168.1.12:8123)
                  </Text>
                </View>

                {/* Access Token Input */}
                <View className="mb-6">
                  <Text className="mb-2 text-sm font-semibold text-gray-700">
                    Access Token <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="flex-row items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
                    <Ionicons
                      name="key-outline"
                      size={24}
                      color="#6B7280"
                      style={{ marginTop: 2 }}
                    />
                    <TextInput
                      className="flex-1 text-base text-gray-900"
                      placeholder="Enter your long-lived access token"
                      placeholderTextColor="#9CA3AF"
                      value={token}
                      onChangeText={setToken}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                  <Text className="mt-1 text-xs text-gray-500">
                    Get token from: Profile → Long-Lived Access Tokens
                  </Text>
                </View>

                {/* Connection Info */}
                <View className="rounded-2xl bg-gray-100 px-4 py-3">
                  <Text className="mb-2 text-xs font-medium text-gray-600">
                    WebSocket URL Preview:
                  </Text>
                  <Text className="font-mono text-xs text-gray-900">
                    ws://{ip || "IP:PORT"}/api/websocket
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer Button */}
            <View className="border-t border-gray-200 bg-white px-6 py-4">
              <TouchableOpacity
                onPress={handleSave}
                disabled={isLoading}
                className={`flex-row items-center justify-center gap-2 rounded-2xl px-6 py-4 ${
                  isLoading ? "bg-gray-400" : "bg-blue-600"
                }`}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <Text className="text-base font-bold text-white">
                    Saving & Connecting...
                  </Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="white" />
                    <Text className="text-base font-bold text-white">
                      Save & Connect
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
