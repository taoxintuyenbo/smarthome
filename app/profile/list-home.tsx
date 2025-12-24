import { AddHomeModal } from "@/components/modals/add-home-modal";
import { useHomeAssistant } from "@/contexts/HomeAssistantContext";
import { HAConfig, HomeStorage } from "@/utils/homeStorage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function ListHomeScreen() {
  const router = useRouter();
  const { isConnected, reconnect } = useHomeAssistant();
  const [haConfig, setHaConfig] = useState<HAConfig | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await HomeStorage.getHAConfig();
      const stored = await HomeStorage.hasStoredConfig();
      setHaConfig(config);
      setHasConfig(stored);
    } catch (error) {
      console.error("Error loading config:", error);
    }
  };

  const handleDeleteConfig = async () => {
    Alert.alert("Delete Configuration", "Revert to default settings?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await HomeStorage.deleteHAConfig();
            await reconnect();
            await loadConfig();
            Alert.alert("Success", "Using default configuration");
          } catch (error) {
            Alert.alert("Error", "Failed to delete configuration");
          }
        },
      },
    ]);
  };

  const handleModalSuccess = () => {
    loadConfig();
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pb-4 pt-12 shadow-sm">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">
            Home Assistant
          </Text>
          <View className="h-10 w-10" />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 py-6">
          {/* Connection Status Card */}
          <View className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View
                  className={`h-12 w-12 items-center justify-center rounded-full ${
                    isConnected ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <Ionicons
                    name={isConnected ? "checkmark-circle" : "close-circle"}
                    size={28}
                    color={isConnected ? "#10B981" : "#EF4444"}
                  />
                </View>
                <View>
                  <Text className="text-base font-bold text-gray-900">
                    {isConnected ? "Connected" : "Disconnected"}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {hasConfig ? "Custom Config" : "Default Config"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {haConfig && (
            <View className="mb-5 rounded-3xl bg-blue-500 from-blue-500 to-blue-600 p-6 ">
              <View className="mb-4">
                <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-100">
                  IP Address
                </Text>
                <Text className="text-2xl font-bold text-white">
                  {haConfig.ip}
                </Text>
              </View>

              <View>
                <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-100">
                  Access Token
                </Text>
                <Text className="font-mono text-sm text-white/90">
                  {haConfig.token.substring(0, 30)}...
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3">
            {/* Edit/Setup Button */}
            <TouchableOpacity
              className="flex-row items-center gap-4 rounded-2xl bg-blue-600 p-5"
              activeOpacity={0.7}
              onPress={() => setIsModalVisible(true)}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Ionicons
                  name={hasConfig ? "create-outline" : "add-outline"}
                  size={24}
                  color="white"
                />
              </View>
              <Text className="flex-1 text-base font-bold text-white">
                {hasConfig ? "Edit Configuration" : "Setup Configuration"}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </TouchableOpacity>

            {/* Delete Button */}
            {hasConfig && (
              <TouchableOpacity
                className="flex-row items-center gap-4 rounded-2xl border-2 border-red-200 bg-white p-5"
                activeOpacity={0.7}
                onPress={handleDeleteConfig}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <Ionicons name="trash-outline" size={24} color="#EF4444" />
                </View>
                <Text className="flex-1 text-base font-bold text-red-600">
                  Delete Configuration
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <AddHomeModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={handleModalSuccess}
      />
    </View>
  );
}
