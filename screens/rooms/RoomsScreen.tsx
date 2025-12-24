import AddRoomModal from "@/components/modals/add-room-modal";
import { useHomeAssistant } from "@/contexts/HomeAssistantContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface AreaInfo {
  area_id: string;
  name: string;
  icon: string | null;
  picture: string | null;
}

export default function RoomsScreen() {
  const router = useRouter();
  const { sendMessage, isConnected } = useHomeAssistant();
  const [areas, setAreas] = useState<AreaInfo[]>([]);
  const [roomEntityCounts, setRoomEntityCounts] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadAreasFromHA = useCallback(async () => {
    if (!isConnected) {
      console.log("Not connected to Home Assistant");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Load all areas
      const areasResponse = await sendMessage({
        type: "config/area_registry/list",
      });

      if (areasResponse && Array.isArray(areasResponse)) {
        setAreas(areasResponse);
        console.log(`📍 Loaded ${areasResponse.length} areas from HA`);

        // 2. Load entity registry
        const entitiesResponse = await sendMessage({
          type: "config/entity_registry/list",
        });

        // 3. Load device registry
        const devicesResponse = await sendMessage({
          type: "config/device_registry/list",
        });

        // 4. Load current states to check availability
        const states = await sendMessage({
          type: "get_states",
        });

        if (entitiesResponse && Array.isArray(entitiesResponse)) {
          const counts: Record<string, number> = {};

          areasResponse.forEach((area) => {
            // Get all entity IDs for this area
            const allEntityIds = new Set<string>();

            // Add direct entities
            const entitiesInArea = entitiesResponse.filter(
              (entity: any) =>
                entity.area_id === area.area_id &&
                (entity.entity_id.startsWith("light.") ||
                  entity.entity_id.startsWith("switch.") ||
                  entity.entity_id.startsWith("fan."))
            );

            entitiesInArea.forEach((entity: any) => {
              allEntityIds.add(entity.entity_id);
            });

            // Add entities from devices
            if (devicesResponse && Array.isArray(devicesResponse)) {
              const devicesInArea = devicesResponse.filter(
                (device: any) => device.area_id === area.area_id
              );

              devicesInArea.forEach((device: any) => {
                const entitiesForDevice = entitiesResponse.filter(
                  (entity: any) =>
                    entity.device_id === device.id &&
                    (entity.entity_id.startsWith("light. ") ||
                      entity.entity_id.startsWith("switch. ") ||
                      entity.entity_id.startsWith("fan. "))
                );
                entitiesForDevice.forEach((entity: any) => {
                  allEntityIds.add(entity.entity_id);
                });
              });
            }

            const availableEntityIds = Array.from(allEntityIds).filter(
              (entityId) => {
                const entityState = states.find(
                  (s: any) => s.entity_id === entityId
                );
                return entityState && entityState.state !== "unavailable";
              }
            );

            counts[area.area_id] = availableEntityIds.length;
            console.log(
              `📊 ${area.name}: ${availableEntityIds.length} available entities (${allEntityIds.size - availableEntityIds.length} unavailable)`
            );
          });

          setRoomEntityCounts(counts);
        }
      }
    } catch (error) {
      console.error("Error loading areas from HA:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, sendMessage]);

  useEffect(() => {
    loadAreasFromHA();
  }, [loadAreasFromHA]);

  useFocusEffect(
    useCallback(() => {
      loadAreasFromHA();
    }, [loadAreasFromHA])
  );

  const navigateToRoomDetail = (
    roomId: string,
    roomName: string,
    roomIcon: string
  ) => {
    router.push({
      pathname: "/room/room-detail",
      params: {
        roomId,
        roomName,
        roomIcon,
      },
    });
  };

  const getIconColor = (icon: string | null) => {
    if (!icon) return "#0066FF";
    const colorMap: Record<string, string> = {
      "mdi: bed": "#EC4899",
      "mdi:silverware-fork-knife": "#10B981",
      "mdi:shower": "#06B6D4",
      "mdi:laptop": "#F59E0B",
      "mdi:garage": "#6B7280",
      "mdi:glass-wine": "#8B5CF6",
      "mdi:sofa": "#0066FF",
      "mdi:cube": "#14B8A6",
    };
    return colorMap[icon] || "#0066FF";
  };

  const getIconBgColor = (icon: string | null) => {
    if (!icon) return "#DBEAFE";
    const colorMap: Record<string, string> = {
      "mdi:bed": "#FCE7F3",
      "mdi: silverware-fork-knife": "#D1FAE5",
      "mdi:shower": "#CFFAFE",
      "mdi:laptop": "#FEF3C7",
      "mdi:garage": "#F3F4F6",
      "mdi:glass-wine": "#EDE9FE",
      "mdi:sofa": "#DBEAFE",
      "mdi:cube": "#CCFBF1",
    };
    return colorMap[icon] || "#DBEAFE";
  };

  const mapIconToIonicons = (icon: string | null): any => {
    if (!icon) return "cube-outline";
    const iconMap: Record<string, string> = {
      "mdi:bed": "bed-outline",
      "mdi: silverware-fork-knife": "restaurant-outline",
      "mdi:shower": "water-outline",
      "mdi:laptop": "laptop-outline",
      "mdi:garage": "car-outline",
      "mdi:glass-wine": "wine-outline",
      "mdi:sofa": "home-outline",
      "mdi:cube": "cube-outline",
    };
    return iconMap[icon] || "cube-outline";
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066FF" />
        <Text className="mt-4 text-gray-500">Loading rooms...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="bg-gray-50 px-5 pb-4 pt-12">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-12 w-12 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={26} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900">Rooms</Text>
            <View className="h-12 w-12" />
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={64} color="#D1D5DB" />
          <Text className="mt-4 text-center text-lg font-semibold text-gray-900">
            Not Connected
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-500">
            Connecting to Home Assistant...
          </Text>
        </View>
      </View>
    );
  }

  const totalDevices = Object.values(roomEntityCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gray-50 px-5 pb-4 pt-12">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              <Ionicons name="chevron-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <View>
              <Text className="text-xs text-gray-500">Manage by</Text>
              <Text className="text-xl font-bold text-gray-900">Rooms</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={loadAreasFromHA}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="refresh-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-6">
          {/* Home Info Card */}
          <View className="mb-6 overflow-hidden rounded-[28px] bg-blue-500 p-5 shadow-xl">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-medium text-white/80">
                  Home Assistant
                </Text>
                <Text className="mt-1 text-3xl font-bold text-white">
                  {areas.length} Rooms
                </Text>
                <Text className="mt-1 text-sm text-white/80">
                  {totalDevices} controllable devices
                </Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <Ionicons name="home" size={32} color="white" />
              </View>
            </View>
          </View>

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-500">
              All Rooms ({areas.length})
            </Text>
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              className="flex-row items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5"
            >
              <Ionicons name="add" size={16} color="white" />
              <Text className="text-xs font-semibold text-white">Add Room</Text>
            </TouchableOpacity>
          </View>

          {/* Empty State */}
          {areas.length === 0 ? (
            <View className="items-center justify-center py-20">
              <Ionicons name="home-outline" size={64} color="#D1D5DB" />
              <Text className="mt-4 text-center text-lg font-semibold text-gray-900">
                No Rooms Found
              </Text>
              <Text className="mt-2 text-center text-sm text-gray-500">
                Create your first room to get started
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(true)}
                className="mt-6 rounded-2xl bg-blue-600 px-6 py-3"
              >
                <Text className="text-base font-semibold text-white">
                  Create
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-3">
              {areas.map((area) => {
                const ioniconsName = mapIconToIonicons(area.icon);
                const deviceCount = roomEntityCounts[area.area_id] || 0;

                return (
                  <TouchableOpacity
                    key={area.area_id}
                    onPress={() =>
                      navigateToRoomDetail(
                        area.area_id,
                        area.name,
                        ioniconsName
                      )
                    }
                    className="rounded-[24px] bg-white p-5 shadow-sm"
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-4">
                      <View
                        className="h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: getIconBgColor(area.icon) }}
                      >
                        <Ionicons
                          name={ioniconsName}
                          size={28}
                          color={getIconColor(area.icon)}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-900">
                          {area.name}
                        </Text>
                        <View className="mt-1 flex-row items-center gap-2">
                          <View className="flex-row items-center gap-1">
                            <Text className="text-sm text-gray-500">
                              {deviceCount} device{deviceCount !== 1 ? "s" : ""}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View className="items-center">
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#9CA3AF"
                          style={{ marginTop: 4 }}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Room Modal */}
      <AddRoomModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRoomCreated={loadAreasFromHA}
        sendMessage={sendMessage}
      />
    </View>
  );
}
