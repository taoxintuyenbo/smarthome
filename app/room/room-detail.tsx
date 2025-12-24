import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useHomeAssistant } from "../../contexts/HomeAssistantContext";

interface HADevice {
  entity_id: string;
  name: string;
  state: string;
  attributes: any;
  brightness?: number;
  temperature?: number;
}

export default function RoomDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { roomId, roomName, roomIcon } = params;
  const { sendMessage, isConnected, subscribeToEvents } = useHomeAssistant();

  const [devices, setDevices] = useState<HADevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedRoomName, setEditedRoomName] = useState(roomName as string);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isControllingAll, setIsControllingAll] = useState(false);

  // Use ref to track room entity IDs for event filtering
  const roomEntityIdsRef = useRef<Set<string>>(new Set());

  // Memoized function to create device from entity
  const createDeviceFromEntity = useCallback((entity: any): HADevice => {
    const device: HADevice = {
      entity_id: entity.entity_id,
      name: entity.attributes?.friendly_name || entity.entity_id,
      state: entity.state,
      attributes: entity.attributes || {},
    };

    if (
      entity.entity_id.startsWith("light. ") &&
      entity.attributes?.brightness
    ) {
      device.brightness = Math.round(
        (entity.attributes.brightness / 255) * 100
      );
    }

    if (
      entity.entity_id.startsWith("climate.") &&
      entity.attributes?.temperature
    ) {
      device.temperature = entity.attributes.temperature;
    }

    return device;
  }, []);

  // Load devices on mount and when connection is established
  useEffect(() => {
    if (isConnected) {
      loadDevices();
    }
  }, [isConnected]);

  // Subscribe to real-time state changes
  useEffect(() => {
    if (!isConnected) return;

    console.log("🔔 Setting up event subscription for room:", roomId);

    const unsubscribe = subscribeToEvents("state_changed", (event) => {
      const entityId = event.data.entity_id;
      const newState = event.data.new_state;
      const oldState = event.data.old_state;

      if (!roomEntityIdsRef.current.has(entityId)) {
        return;
      }

      console.log(`🔄 State changed for ${entityId}:`, newState?.state);

      if (newState) {
        const updatedDevice = createDeviceFromEntity(newState);

        setDevices((prevDevices) => {
          const deviceIndex = prevDevices.findIndex(
            (d) => d.entity_id === entityId
          );

          if (deviceIndex >= 0) {
            const newDevices = [...prevDevices];
            newDevices[deviceIndex] = updatedDevice;
            return newDevices;
          } else {
            console.log(`➕ Adding new device to room:  ${entityId}`);
            return [...prevDevices, updatedDevice];
          }
        });
      } else if (!newState && oldState) {
        console.log(`➖ Removing device from room: ${entityId}`);
        setDevices((prevDevices) =>
          prevDevices.filter((d) => d.entity_id !== entityId)
        );
      }
    });

    return () => {
      console.log("🔕 Cleaning up event subscription");
      unsubscribe();
    };
  }, [isConnected, subscribeToEvents, createDeviceFromEntity, roomId]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const entityRegistry = await sendMessage({
        type: "config/entity_registry/list",
      });

      const states = await sendMessage({ type: "get_states" });

      const roomEntityIds = entityRegistry
        .filter((entry: any) => {
          const belongsToArea = entry.area_id === roomId;
          const isControllableDevice =
            entry.entity_id.startsWith("light.") ||
            entry.entity_id.startsWith("switch. ") ||
            entry.entity_id.startsWith("fan.") ||
            entry.entity_id.startsWith("climate.");

          if (!belongsToArea || !isControllableDevice) {
            return false;
          }

          const entityState = states.find(
            (s: any) => s.entity_id === entry.entity_id
          );

          return entityState && entityState.state !== "unavailable";
        })
        .map((entry: any) => entry.entity_id);

      console.log("📍 Room entity IDs from HA:", roomEntityIds);

      roomEntityIdsRef.current = new Set(roomEntityIds);

      if (roomEntityIds.length === 0) {
        setDevices([]);
        setIsLoading(false);
        return;
      }

      await fetchHADeviceStates(roomEntityIds);
    } catch (error) {
      console.error("Error loading devices:", error);
      setIsLoading(false);
    }
  };

  const fetchHADeviceStates = async (entityIds: string[]) => {
    try {
      const states = await sendMessage({ type: "get_states" });

      if (states && Array.isArray(states)) {
        const updatedDevices = states
          .filter(
            (entity: any) =>
              entityIds.includes(entity.entity_id) &&
              entity.state !== "unavailable"
          )
          .map((entity: any) => createDeviceFromEntity(entity));

        console.log(
          "🎯 Room devices with states fetched:",
          updatedDevices.length
        );

        setDevices(updatedDevices);
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching states:", error);
      setIsLoading(false);
    }
  };

  const toggleDevice = async (entity_id: string, currentState: string) => {
    const newState = currentState === "on" ? "off" : "on";

    setDevices((prev) =>
      prev.map((d) =>
        d.entity_id === entity_id
          ? {
              ...d,
              state: newState,
              brightness:
                newState === "on" && entity_id.startsWith("light.")
                  ? d.brightness || 100
                  : d.brightness,
            }
          : d
      )
    );

    try {
      const service = currentState === "on" ? "turn_off" : "turn_on";
      const domain = entity_id.split(".")[0];

      await sendMessage({
        type: "call_service",
        domain,
        service,
        service_data: {
          entity_id,
        },
      });

      console.log(`🎛️ Toggled ${entity_id} to ${service}`);
    } catch (error) {
      console.error("Error toggling device:", error);
      await loadDevices();
    }
  };

  // ✅ NEW:  Control all devices at once
  const toggleAllDevices = async (turnOn: boolean) => {
    if (devices.length === 0) return;

    setIsControllingAll(true);

    try {
      const service = turnOn ? "turn_on" : "turn_off";

      // Group devices by domain
      const devicesByDomain = devices.reduce(
        (acc, device) => {
          const domain = device.entity_id.split(".")[0];
          if (!acc[domain]) acc[domain] = [];
          acc[domain].push(device.entity_id);
          return acc;
        },
        {} as Record<string, string[]>
      );

      // Send commands for each domain
      for (const [domain, entityIds] of Object.entries(devicesByDomain)) {
        await sendMessage({
          type: "call_service",
          domain,
          service,
          service_data: {
            entity_id: entityIds,
          },
        });
      }

      console.log(
        `✅ ${turnOn ? "Turned on" : "Turned off"} all devices in room`
      );
    } catch (error) {
      console.error("Error controlling all devices:", error);
      Alert.alert("Error", "Failed to control all devices");
    } finally {
      setIsControllingAll(false);
    }
  };

  const updateBrightness = (entity_id: string, value: number) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.entity_id === entity_id ? { ...d, brightness: Math.round(value) } : d
      )
    );
  };

  const setBrightness = async (entity_id: string, value: number) => {
    try {
      const brightness = Math.round((value / 100) * 255);

      await sendMessage({
        type: "call_service",
        domain: "light",
        service: "turn_on",
        service_data: {
          entity_id,
          brightness,
        },
      });

      console.log(`💡 Setting brightness for ${entity_id} to ${value}%`);
    } catch (error) {
      console.error("Error setting brightness:", error);
    }
  };

  const handleSaveRoomName = async () => {
    if (!editedRoomName.trim()) {
      Alert.alert("Error", "Room name cannot be empty");
      return;
    }

    try {
      await sendMessage({
        type: "config/area_registry/update",
        area_id: roomId,
        name: editedRoomName.trim(),
      });

      console.log(`✅ Updated room name to: ${editedRoomName}`);
      setEditMode(false);
      Alert.alert("Success", "Room name updated successfully!");
    } catch (error) {
      console.error("Error updating room name:", error);
      Alert.alert("Error", "Failed to update room name.  Please try again.");
    }
  };

  const handleDeleteRoom = async () => {
    Alert.alert(
      "Delete Room",
      `Are you sure you want to delete "${roomName}"?  This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await sendMessage({
                type: "config/area_registry/delete",
                area_id: roomId,
              });

              console.log(`🗑️ Deleted room:  ${roomName}`);
              Alert.alert("Success", `Room "${roomName}" deleted! `);
              router.back();
            } catch (error) {
              console.error("Error deleting room:", error);
              Alert.alert("Error", "Failed to delete room. Please try again.");
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const getIconForEntity = (entity_id: string): string => {
    if (entity_id.startsWith("light.")) return "bulb-outline";
    if (entity_id.startsWith("switch.")) return "power-outline";
    if (entity_id.startsWith("fan.")) return "snow-outline";
    if (entity_id.startsWith("climate. ")) return "thermometer-outline";
    return "cube-outline";
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066FF" />
        <Text className="mt-4 text-gray-500">Loading devices...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Ionicons name="cloud-offline-outline" size={64} color="#D1D5DB" />
        <Text className="mt-4 text-center text-lg font-semibold text-gray-900">
          Not Connected
        </Text>
        <Text className="mt-2 text-center text-sm text-gray-500">
          Connecting to Home Assistant...
        </Text>
      </View>
    );
  }

  const activeDevices = devices.filter((d) => d.state === "on").length;
  const allDevicesOn = devices.length > 0 && activeDevices === devices.length;
  const allDevicesOff = activeDevices === 0;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gray-50 px-5 pb-4 pt-12">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          <Text className="text-xl font-semibold text-gray-900">
            {editedRoomName}
          </Text>

          <TouchableOpacity
            onPress={() => setEditMode(!editMode)}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons
              name={editMode ? "close" : "create-outline"}
              size={24}
              color={editMode ? "#EF4444" : "#1F2937"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-6">
          {/* Room Header Card */}
          <View className="mb-6 overflow-hidden rounded-[28px] bg-blue-500 shadow-xl">
            <View className="p-6">
              <View className="flex-row items-center gap-4">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                  <Ionicons name={roomIcon as any} size={32} color="white" />
                </View>
                <View className="flex-1">
                  {editMode ? (
                    <View className="flex-row items-start gap-2">
                      <TextInput
                        value={editedRoomName}
                        onChangeText={setEditedRoomName}
                        className="flex-1 rounded-xl bg-white/30 px-4 pb-2 text-xl font-bold text-white border-2 border-white/50"
                        placeholderTextColor="#FFFFFF80"
                        placeholder="Room name"
                        onSubmitEditing={handleSaveRoomName}
                        multiline
                        numberOfLines={2}
                        style={{
                          minHeight: 50,
                          textAlignVertical: "top",
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleSaveRoomName}
                        className="h-12 w-12 items-center justify-center rounded-full bg-white/30 mt-1"
                      >
                        <Ionicons name="checkmark" size={24} color="white" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text className="text-2xl font-bold text-white">
                      {editedRoomName}
                    </Text>
                  )}
                  <Text className="mt-1 text-sm text-white/80">
                    {activeDevices} of {devices.length} active
                  </Text>
                </View>
              </View>

              <View className="mt-5 flex-row items-center justify-around rounded-2xl bg-white/20 px-4 py-4">
                <View className="items-center">
                  <Text className="text-sm font-medium text-white/80">
                    Total
                  </Text>
                  <Text className="mt-1 text-xl font-bold text-white">
                    {devices.length}
                  </Text>
                </View>
                <View className="h-8 w-px bg-white/30" />
                <View className="items-center">
                  <Text className="text-sm font-medium text-white/80">
                    Active
                  </Text>
                  <Text className="mt-1 text-xl font-bold text-white">
                    {activeDevices}
                  </Text>
                </View>
                <View className="h-8 w-px bg-white/30" />
                <View className="items-center">
                  <Text className="text-sm font-medium text-white/80">Off</Text>
                  <Text className="mt-1 text-xl font-bold text-white">
                    {devices.length - activeDevices}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ✅ NEW: Control All Buttons */}
          {/* {devices.length > 0 && (
            <View className="mb-6 flex-row gap-3">
              <TouchableOpacity
                onPress={() => toggleAllDevices(true)}
                disabled={isControllingAll || allDevicesOn}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
                  isControllingAll || allDevicesOn
                    ? "bg-gray-300"
                    : "bg-green-500"
                }`}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="power"
                  size={20}
                  color={isControllingAll || allDevicesOn ? "#9CA3AF" : "white"}
                />
                <Text
                  className={`text-base font-semibold ${
                    isControllingAll || allDevicesOn
                      ? "text-gray-500"
                      : "text-white"
                  }`}
                >
                  Turn All On
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => toggleAllDevices(false)}
                disabled={isControllingAll || allDevicesOff}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
                  isControllingAll || allDevicesOff
                    ? "bg-gray-300"
                    : "bg-red-500"
                }`}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="power-outline"
                  size={20}
                  color={
                    isControllingAll || allDevicesOff ? "#9CA3AF" : "white"
                  }
                />
                <Text
                  className={`text-base font-semibold ${
                    isControllingAll || allDevicesOff
                      ? "text-gray-500"
                      : "text-white"
                  }`}
                >
                  Turn All Off
                </Text>
              </TouchableOpacity>
            </View>
          )} */}

          {/* Devices Section */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-gray-800">Devices</Text>
            <Text className="text-sm font-semibold text-gray-500">
              {devices.length} total
            </Text>
          </View>

          {devices.length === 0 ? (
            <View className="items-center justify-center rounded-[28px] bg-white p-12 shadow-sm">
              <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
              <Text className="mt-4 text-center text-base font-semibold text-gray-900">
                No devices in this room
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-500">
                Assign devices to this room from device settings
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {devices.map((device) => (
                <View
                  key={device.entity_id}
                  className="rounded-[28px] bg-white p-5 shadow-sm"
                >
                  <View className="flex-row items-center gap-4">
                    <View
                      className={`h-16 w-16 items-center justify-center rounded-[20px] ${
                        device.state === "on" ? "bg-blue-100" : "bg-gray-100"
                      }`}
                    >
                      <Ionicons
                        name={getIconForEntity(device.entity_id) as any}
                        size={32}
                        color={device.state === "on" ? "#0066FF" : "#9CA3AF"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-900">
                        {device.name}
                      </Text>
                      <Text className="mt-0.5 text-sm text-gray-500 capitalize">
                        {device.entity_id.split(".")[0]}
                      </Text>
                    </View>
                    <View className="items-end gap-2">
                      <Switch
                        value={device.state === "on"}
                        onValueChange={() =>
                          toggleDevice(device.entity_id, device.state)
                        }
                        trackColor={{ false: "#E5E7EB", true: "#0066FF" }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#E5E7EB"
                      />
                    </View>
                  </View>

                  {/* Brightness Slider */}
                  {device.state === "on" && device.brightness !== undefined && (
                    <View className="mt-5 flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => {
                          const currentBrightness = device.brightness ?? 0;
                          const newValue = Math.max(0, currentBrightness - 10);
                          updateBrightness(device.entity_id, newValue);
                          setBrightness(device.entity_id, newValue);
                        }}
                        className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={24} color="#6B7280" />
                      </TouchableOpacity>

                      <Slider
                        style={{ flex: 1, height: 40 }}
                        minimumValue={0}
                        maximumValue={100}
                        value={device.brightness ?? 0}
                        onValueChange={(value) =>
                          updateBrightness(device.entity_id, value)
                        }
                        onSlidingComplete={(value) =>
                          setBrightness(device.entity_id, value)
                        }
                        minimumTrackTintColor="#0066FF"
                        maximumTrackTintColor="#E5E7EB"
                        thumbTintColor="#0066FF"
                      />

                      <Text className="w-14 text-center text-base font-bold text-gray-600">
                        {device.brightness ?? 0}%
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          const currentBrightness = device.brightness ?? 0;
                          const newValue = Math.min(
                            100,
                            currentBrightness + 10
                          );
                          updateBrightness(device.entity_id, newValue);
                          setBrightness(device.entity_id, newValue);
                        }}
                        className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={24} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Delete Room Button */}
          <TouchableOpacity
            onPress={handleDeleteRoom}
            disabled={isDeleting}
            className={`mt-8 mb-4 flex-row items-center justify-center gap-2 rounded-2xl px-6 py-4 border-2 ${
              isDeleting
                ? "bg-gray-100 border-gray-300"
                : "bg-red-50 border-red-200"
            }`}
            activeOpacity={0.8}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color={isDeleting ? "#9CA3AF" : "#EF4444"}
            />
            <Text
              className={`text-base font-bold ${
                isDeleting ? "text-gray-500" : "text-red-600"
              }`}
            >
              {isDeleting ? "Deleting..." : "Delete Room"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
