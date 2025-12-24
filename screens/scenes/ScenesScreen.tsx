import { AddAutomationModal } from "@/components/modals/add-automation-modal";
import { HA_CONFIG, useHomeAssistant } from "@/contexts/HomeAssistantContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Device {
  id: number;
  entity_id: string;
  name: string;
  originalName: string;
  description: string;
  status: string;
  state: string;
  attributes: any;
}

interface HAAutomation {
  entity_id: string;
  automation_id: string;
  name: string;
  state: string;
  attributes: any;
}

export default function DeviceScreen() {
  const router = useRouter();
  const { sendMessage, isConnected, subscribeToEvents } = useHomeAssistant();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automations, setAutomations] = useState<HAAutomation[]>([]);
  const [isAddAutomationModalVisible, setIsAddAutomationModalVisible] =
    useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDevices = useCallback(async () => {
    if (!isConnected) {
      console.log("Not connected to Home Assistant");
      return;
    }

    setLoading(true);
    try {
      const states = await sendMessage({ type: "get_states" });

      console.log("📦 Total states:", states.length);

      const processedDevices = states
        .filter((entity: any) => {
          const isMatch =
            (entity.entity_id.startsWith("light.") ||
              entity.entity_id.startsWith("switch.") ||
              entity.entity_id.startsWith("fan.")) &&
            entity.state !== "unavailable";
          if (isMatch) {
            console.log("✅ Matched device:", entity.entity_id);
            console.log("State :", entity.state);
          }

          return isMatch;
        })
        .map((entity: any, index: number) => ({
          id: index + 1,
          entity_id: entity.entity_id,
          name: entity.attributes?.friendly_name || entity.entity_id,
          originalName: entity.attributes?.friendly_name || entity.entity_id,
          description: `${entity.entity_id}`,
          status: entity.state.toUpperCase(),
          state: entity.state,
          attributes: entity.attributes,
        }));

      console.log("🎯 Processed devices:", processedDevices.length);
      setDevices(processedDevices);
      setLoading(false);
    } catch (error) {
      console.error("Error loading devices:", error);
      setError("Failed to load devices");
      setLoading(false);
    }
  }, [isConnected, sendMessage]);

  const loadAutomations = useCallback(async () => {
    if (!isConnected) return;

    try {
      const states = await sendMessage({ type: "get_states" });
      const automationEntities = states
        .filter(
          (entity: any) =>
            entity.entity_id.startsWith("automation.") &&
            entity.state !== "unavailable"
        )
        .map((entity: any) => ({
          entity_id: entity.entity_id,
          automation_id: entity.entity_id.replace("automation.", ""),
          name: entity.attributes?.friendly_name || entity.entity_id,
          state: entity.state,
          attributes: entity.attributes,
        }));

      console.log(`✅ Loaded ${automationEntities.length} automations from HA`);
      console.log(automationEntities);

      setAutomations(automationEntities);
    } catch (error) {
      console.error("Error loading automations:", error);
      setAutomations([]);
    }
  }, [isConnected, sendMessage]);

  useEffect(() => {
    if (isConnected) {
      loadDevices();
      loadAutomations();
    }
  }, [isConnected, loadDevices, loadAutomations]);

  useEffect(() => {
    if (!isConnected || devices.length === 0) return;

    const unsubscribe = subscribeToEvents("state_changed", (event) => {
      const entityId = event.data.entity_id;
      const newState = event.data.new_state;

      // Handle device state changes
      const deviceExists = devices.some((d) => d.entity_id === entityId);
      if (deviceExists && newState) {
        console.log("🔄 Device state changed:", entityId, newState.state);

        setDevices((prev) =>
          prev.map((device) =>
            device.entity_id === entityId
              ? {
                  ...device,
                  state: newState.state,
                  status: newState.state.toUpperCase(),
                  attributes: newState.attributes,
                  name: newState.attributes?.friendly_name || device.entity_id,
                  originalName:
                    newState.attributes?.friendly_name || device.entity_id,
                }
              : device
          )
        );
      }

      if (entityId.startsWith("automation.")) {
        console.log("🔄 Automation state changed:", entityId);
        loadAutomations();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, devices, subscribeToEvents, loadAutomations]);

  useFocusEffect(
    useCallback(() => {
      if (isConnected) {
        loadDevices();
        loadAutomations();
      }
    }, [isConnected, loadDevices, loadAutomations])
  );

  const triggerAutomation = async (automation: HAAutomation) => {
    try {
      if (!isConnected) {
        Alert.alert("Error", "Not connected to Home Assistant");
        return;
      }

      // Trigger the automation
      await sendMessage({
        type: "call_service",
        domain: "automation",
        service: "trigger",
        service_data: {
          entity_id: automation.entity_id,
        },
      });

      console.log(`✅ Triggered automation: ${automation.name}`);
    } catch (error) {
      console.error("Error triggering automation:", error);
      Alert.alert("Error", "Failed to trigger automation");
    }
  };

  const deleteAutomation = async (automation: HAAutomation) => {
    if (isDeleting) return;

    // Check if automation.attributes?.id exists
    if (!automation.attributes?.id) {
      Alert.alert(
        "Error",
        "Cannot delete: Automation ID not found in attributes"
      );
      return;
    }

    Alert.alert(
      "Delete Automation",
      `Are you sure you want to delete "${automation.name}" from Home Assistant?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const baseUrl = HA_CONFIG.URL.replace("ws://", "http://").replace(
                "/api/websocket",
                ""
              );

              console.log(
                `🗑️ Deleting automation: ${automation.attributes.id}`
              );

              const response = await fetch(
                `${baseUrl}/api/config/automation/config/${automation.attributes.id}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${HA_CONFIG.TOKEN}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
              }

              console.log("Automations before reload:", automations);
              await loadAutomations();
              console.log("Automations after reload:", automations);
            } catch (error) {
              console.error("Error deleting automation:", error);
              Alert.alert(
                "Error",
                `Failed to delete automation from Home Assistant.\n\n${error}`
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const clearAllAutomations = async () => {
    if (automations.length === 0) return;

    Alert.alert(
      "Clear All Automations",
      `Are you sure you want to delete ALL ${automations.length} automations from Home Assistant?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const baseUrl = HA_CONFIG.URL.replace("ws://", "http://").replace(
                "/api/websocket",
                ""
              );

              console.log(`🗑️ Deleting ${automations.length} automations...`);

              // Delete all automations
              for (const automation of automations) {
                if (!automation.attributes?.id) {
                  console.error(
                    `❌ Skipping ${automation.name}: No attributes.id found`
                  );
                  continue;
                }

                try {
                  const response = await fetch(
                    `${baseUrl}/api/config/automation/config/${automation.attributes.id}`,
                    {
                      method: "DELETE",
                      headers: {
                        Authorization: `Bearer ${HA_CONFIG.TOKEN}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );

                  if (!response.ok) {
                    console.error(
                      `Failed to delete ${automation.name}: ${response.status}`
                    );
                  } else {
                    console.log(`✅ Deleted ${automation.name}`);
                  }
                } catch (error) {
                  console.error(`Error deleting ${automation.name}:`, error);
                }
              }

              console.log("✅ Finished deleting automations");
              await loadAutomations();
            } catch (error) {
              console.error("Error clearing automations:", error);
              Alert.alert("Error", "Failed to clear all automations");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleAddAutomationSuccess = () => {
    loadAutomations();
  };

  const navigateToDeviceDetail = (device: Device) => {
    router.push({
      pathname: "/device/[id]" as any,
      params: {
        id: device.entity_id,
        entity_id: device.entity_id,
        name: device.name,
        originalName: device.originalName,
        state: device.state,
        status: device.status,
      },
    });
  };

  const getIconForEntity = (entity_id: string): string => {
    if (entity_id.startsWith("light.")) return "bulb-outline";
    if (entity_id.startsWith("switch.")) return "power-outline";
    if (entity_id.startsWith("fan.")) return "ellipse-outline";
    return "cube-outline";
  };

  const getAutomationLastTriggered = (automation: HAAutomation): string => {
    if (automation.attributes?.last_triggered) {
      const date = new Date(automation.attributes.last_triggered);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return "Just now";
    }
    return "Never";
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066FF" />
        <Text className="mt-4 text-gray-500">Loading devices...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-5">
        <Ionicons name="cloud-offline-outline" size={64} color="#D1D5DB" />
        <Text className="mt-4 text-center text-xl font-semibold text-gray-900">
          Not Connected
        </Text>
        <Text className="mt-2 text-center text-sm text-gray-500">
          Connecting to Home Assistant...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-5">
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text className="mt-4 text-center text-xl font-semibold text-gray-900">
          {error}
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-[24px] bg-blue-600 px-6 py-3 shadow-sm"
          onPress={() => {
            setError(null);
            loadDevices();
          }}
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold text-white">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gray-50 px-5 pb-4 pt-12">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm text-gray-600">Control Panel</Text>
            <Text className="text-2xl font-bold text-gray-900">
              Devices & Automation
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/device/add-device")}
            className="h-12 w-12 items-center justify-center"
          >
            <Ionicons name="add-circle-outline" size={26} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8">
          <View className="mb-6 mt-2 overflow-hidden rounded-[28px] bg-blue-500 p-6 shadow-xl">
            <View className="flex-row items-center gap-4">
              <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-white/20">
                <Ionicons name="hardware-chip" size={40} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-white">
                  {devices.length} Devices
                </Text>
                <Text className="mt-1 text-sm text-white/90">
                  From Home Assistant
                </Text>
                <Text className="mt-0.5 text-xs text-white/80">
                  {automations.length} automations active
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row items-center justify-around rounded-2xl bg-white/20 px-4 py-4">
              <View className="items-center">
                <Text className="text-sm font-medium text-white/80">
                  Lights
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {
                    devices.filter((d) => d.entity_id.startsWith("light."))
                      .length
                  }
                </Text>
              </View>
              <View className="h-8 w-px bg-white/30" />
              <View className="items-center">
                <Text className="text-sm font-medium text-white/80">
                  Switches
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {
                    devices.filter((d) => d.entity_id.startsWith("switch."))
                      .length
                  }
                </Text>
              </View>
              <View className="h-8 w-px bg-white/30" />
              <View className="items-center">
                <Text className="text-sm font-medium text-white/80">Fans</Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {devices.filter((d) => d.entity_id.startsWith("fan.")).length}
                </Text>
              </View>
            </View>
          </View>

          {/* All Devices Section */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-gray-800">
              All Devices
            </Text>
            {devices.length === 0 ? (
              <View className="items-center justify-center rounded-[24px] bg-white p-12 shadow-sm">
                <Ionicons
                  name="hardware-chip-outline"
                  size={64}
                  color="#D1D5DB"
                />
                <Text className="mt-4 text-center text-base font-semibold text-gray-900">
                  No devices found
                </Text>
                <Text className="mt-2 text-center text-sm text-gray-500">
                  No devices available in Home Assistant
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {devices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                    onPress={() => navigateToDeviceDetail(device)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-1 flex-row items-center gap-4">
                      <View
                        className={`h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                          device.state === "on" ? "bg-blue-100" : "bg-gray-100"
                        }`}
                      >
                        <Ionicons
                          name={getIconForEntity(device.entity_id) as any}
                          size={24}
                          color={device.state === "on" ? "#0066FF" : "#9CA3AF"}
                        />
                      </View>
                      <View className="flex-1 flex-shrink">
                        <Text
                          className="text-base font-semibold text-gray-900"
                          numberOfLines={2}
                        >
                          {device.name}
                        </Text>
                        <Text className="text-sm capitalize text-gray-500">
                          {device.entity_id.split(".")[0]}
                        </Text>
                      </View>
                    </View>
                    <View className="ml-3 flex-shrink-0 items-end gap-2">
                      <View
                        className={`rounded-full px-3 py-1 ${
                          device.state === "on" ? "bg-green-500" : "bg-gray-400"
                        }`}
                      >
                        <Text className="text-xs font-semibold text-white">
                          {device.status}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Automation Section */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-gray-800">
              Automation & Scenarios
            </Text>
            <View className="gap-3">
              {/* Create Automation Button */}
              <TouchableOpacity
                onPress={() => setIsAddAutomationModalVisible(true)}
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-1 flex-row items-center gap-4">
                  <View className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100">
                    <Ionicons name="flash-outline" size={24} color="#0066FF" />
                  </View>
                  <View className="flex-1 flex-shrink">
                    <Text
                      className="text-base font-semibold text-gray-900"
                      numberOfLines={1}
                    >
                      Create New Automation
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Schedule device actions
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {/* {automations.length > 0 && (
                <TouchableOpacity
                  onPress={clearAllAutomations}
                  disabled={isDeleting}
                  className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                  activeOpacity={0.7}
                >
                  <View className="flex-1 flex-row items-center gap-4">
                    <View className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-red-100">
                      <Ionicons
                        name="trash-outline"
                        size={24}
                        color="#EF4444"
                      />
                    </View>
                    <View className="flex-1 flex-shrink">
                      <Text
                        className="text-base font-semibold text-gray-900"
                        numberOfLines={1}
                      >
                        Clear All Automations
                      </Text>
                      <Text className="text-sm text-gray-500">
                        Delete from Home Assistant
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )} */}
            </View>
          </View>

          {/* Automations List */}
          {/* Automations List */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-gray-800">
              My Automations ({automations.length})
            </Text>
            {!automations || automations.length === 0 ? (
              <View className="items-center justify-center rounded-[24px] bg-white p-12 shadow-sm">
                <Ionicons name="flash-outline" size={64} color="#D1D5DB" />
                <Text className="mt-4 text-center text-base font-semibold text-gray-900">
                  No automations yet
                </Text>
                <Text className="mt-2 text-center text-sm text-gray-500">
                  Create an automation to schedule device actions
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {automations.map((automation) => {
                  // Safety check - skip if automation is invalid
                  if (!automation || !automation.entity_id) return null;

                  return (
                    <View
                      key={automation.entity_id}
                      className="rounded-[24px] bg-white p-5 shadow-sm"
                    >
                      <TouchableOpacity
                        onPress={() => triggerAutomation(automation)}
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center gap-4">
                          <View
                            className={`h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                              automation.state === "on"
                                ? "bg-blue-100"
                                : "bg-gray-100"
                            }`}
                          >
                            <Ionicons
                              name="flash"
                              size={24}
                              color={
                                automation.state === "on"
                                  ? "#0066FF"
                                  : "#9CA3AF"
                              }
                            />
                          </View>
                          <View className="flex-1 flex-shrink">
                            <Text
                              className="text-base font-semibold text-gray-900"
                              numberOfLines={2}
                            >
                              {automation.name}
                            </Text>
                            <Text className="text-sm text-gray-500">
                              <Text className="text-blue-600">
                                {"Latest trigger: "}
                                {getAutomationLastTriggered(automation)}
                              </Text>
                            </Text>
                          </View>
                          {/* {automation.attributes?.id ? (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                deleteAutomation(automation);
                              }}
                              disabled={isDeleting}
                              className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50"
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={18}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          ) : (
                            <View className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                              <Ionicons
                                name="lock-closed"
                                size={18}
                                color="#9CA3AF"
                              />
                            </View>
                          )} */}
                        </View>
                      </TouchableOpacity>

                      <View className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
                        <Text className="text-xs text-blue-700">
                          ID:{" "}
                          {automation.attributes?.id ||
                            automation.automation_id}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Automation Modal */}
      <AddAutomationModal
        visible={isAddAutomationModalVisible}
        onClose={() => setIsAddAutomationModalVisible(false)}
        onSuccess={handleAddAutomationSuccess}
      />
    </View>
  );
}
