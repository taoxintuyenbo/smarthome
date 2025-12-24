import { HA_CONFIG } from "@/config/homeAssistant";
import { DeviceStorage } from "@/utils/deviceStorage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface AddDeviceModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roomId: string;
  homeId: string;
  roomName: string;
}

interface HADevice {
  entity_id: string;
  name: string;
  originalName: string;
  state: string;
  icon: string;
  type: string;
}

export function AddDeviceModal({
  visible,
  onClose,
  onSuccess,
  roomId,
  homeId,
  roomName,
}: AddDeviceModalProps) {
  const [allDevices, setAllDevices] = useState<HADevice[]>([]);
  const [availableDevices, setAvailableDevices] = useState<HADevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (visible) {
      loadHADevices();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [visible]);

  const loadHADevices = async () => {
    setIsLoading(true);
    let messageId = 1;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(HA_CONFIG.URL);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "auth_required") {
        ws.send(
          JSON.stringify({ type: "auth", access_token: HA_CONFIG.TOKEN })
        );
      } else if (message.type === "auth_ok") {
        ws.send(JSON.stringify({ id: messageId++, type: "get_states" }));
      } else if (message.type === "result" && message.success) {
        const customNames = await DeviceStorage.getCustomNames();
        const roomAssignments = await DeviceStorage.getRoomAssignments();
        const states = message.result;

        console.log("📦 Total HA states:", states.length);
        console.log(
          "🏷️  Custom names in storage:",
          Object.keys(customNames).length
        );

        // Get HA entity IDs (lights, switches, fans)
        const haDevices = states.filter(
          (entity: any) =>
            entity.entity_id.startsWith("light.") ||
            entity.entity_id.startsWith("switch.") ||
            entity.entity_id.startsWith("fan.")
        );

        console.log("💡 HA devices (light/switch/fan):", haDevices.length);

        // Build device list with custom names
        const devices: HADevice[] = haDevices
          .filter((entity: any) => customNames[entity.entity_id])
          .map((entity: any) => ({
            entity_id: entity.entity_id,
            name: customNames[entity.entity_id],
            originalName: entity.attributes.friendly_name || entity.entity_id,
            state: entity.state,
            icon: getIconForEntityType(entity.entity_id),
            type: getTypeForEntity(entity.entity_id),
          }));

        console.log("✅ Devices with custom names:", devices.length);
        setAllDevices(devices);

        const assignedEntityIds = Object.keys(roomAssignments);

        const available = devices.filter(
          (d) => !assignedEntityIds.includes(d.entity_id)
        );

        console.log("📋 Total assigned devices:", assignedEntityIds.length);
        console.log("🆓 Available (unassigned) devices:", available.length);

        if (available.length > 0) {
          console.log("Available devices:");
          available.forEach((d) =>
            console.log(`  - ${d.name} (${d.entity_id})`)
          );
        }

        setAvailableDevices(available);
        setIsLoading(false);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsLoading(false);
    };
  };

  const getIconForEntityType = (entity_id: string): string => {
    if (entity_id.startsWith("light.")) return "bulb-outline";
    if (entity_id.startsWith("switch.")) return "power-outline";
    if (entity_id.startsWith("fan.")) return "fan-outline";
    return "cube-outline";
  };

  const getTypeForEntity = (entity_id: string): string => {
    if (entity_id.startsWith("light.")) return "Light";
    if (entity_id.startsWith("switch.")) return "Switch";
    if (entity_id.startsWith("fan.")) return "Fan";
    return "Device";
  };

  const handleAssignDevice = async (entity_id: string) => {
    try {
      await DeviceStorage.assignDeviceToRoom(entity_id, roomId, homeId);
      console.log(`✅ Assigned ${entity_id} to ${roomName}`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("❌ Error assigning device:", error);
      alert("Failed to assign device. Please try again.");
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    if (wsRef.current) {
      wsRef.current.close();
    }
    onClose();
  };

  const filteredDevices = availableDevices.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <View className="h-[85%] rounded-t-[32px] bg-white">
            <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
              <TouchableOpacity
                onPress={handleClose}
                className="h-10 w-10 items-center justify-center"
              >
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-900">
                Add Device to Room
              </Text>
              <View className="h-10 w-10" />
            </View>

            {isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#0066FF" />
                <Text className="mt-4 text-gray-500">Loading devices...</Text>
              </View>
            ) : (
              <ScrollView
                className="flex-1 bg-gray-50"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                <View className="px-6 py-6">
                  {/* Room Info */}
                  <View className="mb-6 rounded-2xl bg-blue-50 p-4">
                    <View className="flex-row items-center gap-3">
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#0066FF"
                      />
                      <Text className="text-sm font-medium text-blue-900">
                        Adding to: {roomName}
                      </Text>
                    </View>
                  </View>

                  {/* Search */}
                  {availableDevices.length > 0 && (
                    <View className="mb-5">
                      <View className="flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3 border border-gray-200">
                        <Ionicons
                          name="search-outline"
                          size={20}
                          color="#6B7280"
                        />
                        <TextInput
                          className="flex-1 text-base text-gray-900"
                          placeholder="Search devices..."
                          placeholderTextColor="#9CA3AF"
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Ionicons
                              name="close-circle"
                              size={20}
                              color="#9CA3AF"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Available Devices */}
                  {filteredDevices.length > 0 ? (
                    <View className="gap-3">
                      {filteredDevices.map((device) => (
                        <TouchableOpacity
                          key={device.entity_id}
                          onPress={() => handleAssignDevice(device.entity_id)}
                          className="flex-row items-center gap-4 rounded-[24px] bg-white p-4 border-2 border-gray-100"
                          activeOpacity={0.7}
                        >
                          <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                            <Ionicons
                              name={device.icon as any}
                              size={24}
                              color="#0066FF"
                            />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-1">
                              <Text className="text-base font-semibold text-gray-900">
                                {device.name}
                              </Text>
                            </View>
                            <Text className="text-xs text-gray-500">
                              {device.type} • {device.state}
                            </Text>
                          </View>
                          <Ionicons
                            name="add-circle"
                            size={28}
                            color="#0066FF"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : availableDevices.length === 0 ? (
                    <View className="items-center justify-center rounded-[24px] bg-white p-12">
                      <Ionicons
                        name="checkbox-outline"
                        size={64}
                        color="#D1D5DB"
                      />
                      <Text className="mt-4 text-center text-base font-semibold text-gray-900">
                        All devices assigned
                      </Text>
                      <Text className="mt-2 text-center text-sm text-gray-500">
                        All your named devices are already assigned to rooms
                      </Text>
                    </View>
                  ) : (
                    <View className="items-center justify-center rounded-[24px] bg-white p-12">
                      <Ionicons
                        name="search-outline"
                        size={64}
                        color="#D1D5DB"
                      />
                      <Text className="mt-4 text-center text-base font-semibold text-gray-900">
                        No matches found
                      </Text>
                      <Text className="mt-2 text-center text-sm text-gray-500">
                        Try a different search term
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
