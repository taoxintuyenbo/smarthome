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
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const { reconnect } = useHomeAssistant();

  // Load existing config when modal opens
  useEffect(() => {
    if (visible) {
      loadExistingConfig();
      setErrorDetails(null); // Clear error when modal opens
    }
  }, [visible]);

  const loadExistingConfig = async () => {
    try {
      const config = await HomeStorage.getHAConfig();
      setIp(config.ip);
      setToken(config.token);
    } catch (error: any) {
      console.error("Error loading config:", error);
      setErrorDetails(`Load Config Error: ${error?.message || error}`);
    }
  };

  // const validateIP = (ipAddress: string): boolean => {
  //   // Allow IP:PORT or just IP format
  //   const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
  //   return ipPattern.test(ipAddress);
  // };

  const handleSave = async () => {
    const trimmedIp = ip.trim();
    const trimmedToken = token.trim();

    setErrorDetails(null); // Clear previous errors

    if (!trimmedIp || !trimmedToken) {
      setErrorDetails("Validation Error: Please fill in both IP and token");
      return;
    }

    // if (!validateIP(trimmedIp)) {
    //   setErrorDetails(
    //     "Invalid IP: Please enter a valid IP address (e.g., 192.168.1.12:8123)"
    //   );
    //   return;
    // }

    setIsLoading(true);
    let step = "unknown";

    try {
      // STEP 1: Save config
      step = "saving config to storage";
      console.log("📦 STEP 1: Saving config to AsyncStorage...");

      await HomeStorage.saveHAConfig({
        ip: trimmedIp,
        token: trimmedToken,
      });

      console.log("✅ STEP 1: Config saved successfully");

      // STEP 2: Verify save
      step = "verifying saved config";
      console.log("🔍 STEP 2: Verifying config was saved...");

      const verifyConfig = await HomeStorage.getHAConfig();
      console.log("✅ STEP 2: Config verified:", {
        ip: verifyConfig.ip,
        tokenLength: verifyConfig.token?.length,
      });

      // STEP 3: Check reconnect function
      step = "checking reconnect function";
      console.log("🔍 STEP 3: Checking reconnect function...");

      if (typeof reconnect !== "function") {
        throw new Error(
          "reconnect is not a function! This is a critical bug in HomeAssistantContext."
        );
      }

      console.log("✅ STEP 3: reconnect function exists");

      // STEP 4: Reconnect
      step = "reconnecting to Home Assistant";
      console.log("🔄 STEP 4: Calling reconnect()...");

      await reconnect();

      console.log("✅ STEP 4: Reconnection successful");
      console.log("🎉 All steps completed successfully!");

      Alert.alert(
        "Success",
        "Home Assistant configuration saved and connected successfully"
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("❌ Error in handleSave:", error);
      console.error("❌ Failed at step:", step);
      console.error("❌ Error type:", typeof error);
      console.error("❌ Error keys:", error ? Object.keys(error) : "none");

      // Extract actual error from event object if needed
      let actualError = error;

      // Check if this is a React Native error event
      if (
        error &&
        typeof error === "object" &&
        "_type" in error &&
        error._type === "error"
      ) {
        console.error("❌ Detected React Native error event");
        // Try to get the actual error from common properties
        actualError = error.error || error.message || error;
      }

      console.error("❌ Actual error:", actualError);

      // Build detailed error message
      let errorMsg = "";

      // Show which step failed
      errorMsg += `❌ FAILED AT: ${step}\n\n`;

      // Check if reconnect function exists
      if (typeof reconnect !== "function") {
        errorMsg += "🚨 CRITICAL: reconnect is not a function!\n";
        errorMsg +=
          "This means HomeAssistantContext is not working properly.\n\n";
      }

      // Error name and message
      if (actualError?.name) {
        errorMsg += `Type: ${actualError.name}\n\n`;
      }

      if (actualError?.message) {
        errorMsg += `Message: ${actualError.message}\n\n`;
      } else if (typeof actualError === "string") {
        errorMsg += `Message: ${actualError}\n\n`;
      } else if (actualError && typeof actualError === "object") {
        // Try to extract meaningful info from object
        errorMsg += `Raw Error Object:\n`;
        try {
          const errorStr = JSON.stringify(actualError, null, 2);
          errorMsg +=
            errorStr.substring(0, 500) + (errorStr.length > 500 ? "..." : "");
          errorMsg += "\n\n";
        } catch (e) {
          errorMsg += "Could not stringify error object\n\n";
        }
      } else {
        errorMsg += `Message: ${String(actualError)}\n\n`;
      }

      // Error code if available
      if (actualError?.code) {
        errorMsg += `Code: ${actualError.code}\n\n`;
      }

      // Stack trace (first 5 lines)
      if (actualError?.stack) {
        const stackLines = actualError.stack.split("\n").slice(0, 5).join("\n");
        errorMsg += `Stack:\n${stackLines}`;
      }

      // Add context about what was being done
      errorMsg += `\n\nContext:\n`;
      errorMsg += `- IP: ${trimmedIp}\n`;
      errorMsg += `- Token Length: ${trimmedToken.length}\n`;
      errorMsg += `- Platform: ${Platform.OS}\n`;

      setErrorDetails(errorMsg.trim());

      // Don't show Alert - the error banner in UI is better
      // Alert removed to avoid [object Object] confusion
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setErrorDetails(null);
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
          <View className="h-[90%] rounded-t-[32px] bg-white">
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
                {/* Error Display */}
                {errorDetails && (
                  <View className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
                    <View className="mb-3 flex-row items-center gap-2">
                      <Ionicons name="alert-circle" size={24} color="#DC2626" />
                      <Text className="flex-1 text-base font-bold text-red-900">
                        ⚠️ Configuration Failed
                      </Text>
                      <TouchableOpacity
                        onPress={() => setErrorDetails(null)}
                        className="h-6 w-6 items-center justify-center"
                      >
                        <Ionicons name="close" size={20} color="#DC2626" />
                      </TouchableOpacity>
                    </View>

                    <View className="mb-3 rounded-xl bg-red-100 px-3 py-2">
                      <Text className="text-xs font-semibold text-red-900">
                        Read the details below to understand what went wrong:
                      </Text>
                    </View>

                    <ScrollView
                      className="max-h-64"
                      nestedScrollEnabled={true}
                      style={{ backgroundColor: "#FEE2E2" }}
                    >
                      <Text
                        className="font-mono text-xs leading-5 text-red-900"
                        selectable={true}
                      >
                        {errorDetails}
                      </Text>
                    </ScrollView>

                    <TouchableOpacity
                      onPress={() => {
                        console.log("=".repeat(50));
                        console.log("📋 FULL ERROR DETAILS:");
                        console.log("=".repeat(50));
                        console.log(errorDetails);
                        console.log("=".repeat(50));
                      }}
                      className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-red-600 py-3"
                    >
                      <Ionicons name="bug-outline" size={18} color="white" />
                      <Text className="text-sm font-bold text-white">
                        Log Full Error to Console
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

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

                {/* Debug Info */}
                <View className="mt-4 rounded-2xl bg-yellow-50 px-4 py-3">
                  <Text className="mb-1 text-xs font-semibold text-yellow-900">
                    Debug Info:
                  </Text>
                  <Text className="font-mono text-xs text-yellow-800">
                    Platform: {Platform.OS}
                  </Text>
                  <Text className="font-mono text-xs text-yellow-800">
                    IP Length: {ip.length}
                  </Text>
                  <Text className="font-mono text-xs text-yellow-800">
                    Token Length: {token.length}
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
