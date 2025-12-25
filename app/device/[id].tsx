import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useHomeAssistant } from "../../contexts/HomeAssistantContext";

interface HAArea {
  area_id: string;
  name: string;
  picture?: string;
}

interface DeviceState {
  state: string;
  brightness?: number;
  colorTemp?: number; // ✅ NEW
  minColorTemp?: number; // ✅ NEW
  maxColorTemp?: number; // ✅ NEW
  supportsColorTemp?: boolean; // ✅ NEW
  attributes: any;
}

export default function DeviceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { sendMessage, isConnected, subscribeToEvents } = useHomeAssistant();

  const entity_id = params.entity_id as string;
  const originalName = params.originalName as string;

  const [customName, setCustomName] = useState(originalName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [state, setState] = useState("off");
  const [brightness, setBrightnessValue] = useState<number | undefined>(
    undefined
  );
  const [colorTemp, setColorTempValue] = useState<number | undefined>(
    undefined
  ); // ✅ NEW
  const [minColorTemp, setMinColorTemp] = useState<number>(153); // ✅ NEW
  const [maxColorTemp, setMaxColorTemp] = useState<number>(500); // ✅ NEW
  const [supportsColorTemp, setSupportsColorTemp] = useState(false); // ✅ NEW
  const [attributes, setAttributes] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(null);
  const [currentAreaName, setCurrentAreaName] = useState<string>("None");
  const [areas, setAreas] = useState<HAArea[]>([]);
  const [isRoomModalVisible, setIsRoomModalVisible] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const isInitialMount = useRef(true);

  // ✅ Enhanced to detect color temperature support
  const createDeviceState = useCallback((entity: any): DeviceState => {
    const deviceState: DeviceState = {
      state: entity.state,
      attributes: entity.attributes || {},
    };

    if (entity.entity_id.startsWith("light.")) {
      // Brightness
      if (entity.attributes?.brightness) {
        deviceState.brightness = Math.round(
          (entity.attributes.brightness / 255) * 100
        );
      }

      // ✅ Color temperature detection
      const supportedModes = entity.attributes?.supported_color_modes || [];
      deviceState.supportsColorTemp = supportedModes.includes("color_temp");

      if (deviceState.supportsColorTemp) {
        deviceState.colorTemp = entity.attributes?.color_temp || 250;
        deviceState.minColorTemp = entity.attributes?.min_color_temp_kelvin
          ? Math.round(1000000 / entity.attributes.max_color_temp_kelvin)
          : entity.attributes?.min_mireds || 153;
        deviceState.maxColorTemp = entity.attributes?.max_color_temp_kelvin
          ? Math.round(1000000 / entity.attributes.min_color_temp_kelvin)
          : entity.attributes?.max_mireds || 500;
      }
    }

    return deviceState;
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadDeviceState();
      loadAreas();
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;

    console.log("🔔 Setting up event subscription for device:", entity_id);

    const unsubscribe = subscribeToEvents("state_changed", (event) => {
      if (event.data.entity_id !== entity_id) return;

      const newState = event.data.new_state;

      if (newState) {
        console.log(`🔄 State changed for ${entity_id}:`, newState.state);

        const updatedState = createDeviceState(newState);

        setState(updatedState.state);
        setAttributes(updatedState.attributes);

        if (updatedState.brightness !== undefined) {
          setBrightnessValue(updatedState.brightness);
        }

        // ✅ Update color temp
        if (updatedState.supportsColorTemp) {
          setColorTempValue(updatedState.colorTemp);
          setMinColorTemp(updatedState.minColorTemp || 153);
          setMaxColorTemp(updatedState.maxColorTemp || 500);
          setSupportsColorTemp(true);
        }

        if (newState.attributes?.friendly_name) {
          setCustomName(newState.attributes.friendly_name);
        }
      }
    });

    return () => {
      console.log("🔕 Cleaning up event subscription");
      unsubscribe();
    };
  }, [isConnected, subscribeToEvents, entity_id, createDeviceState]);

  const loadDeviceState = async () => {
    setIsLoading(true);
    try {
      const states = await sendMessage({ type: "get_states" });

      if (states && Array.isArray(states)) {
        const deviceState = states.find((s: any) => s.entity_id === entity_id);

        if (deviceState) {
          const parsedState = createDeviceState(deviceState);
          setState(parsedState.state);
          setAttributes(parsedState.attributes);
          setBrightnessValue(parsedState.brightness);
          setCustomName(
            deviceState.attributes?.friendly_name || deviceState.entity_id
          );

          // ✅ Set color temp state
          if (parsedState.supportsColorTemp) {
            setColorTempValue(parsedState.colorTemp);
            setMinColorTemp(parsedState.minColorTemp || 153);
            setMaxColorTemp(parsedState.maxColorTemp || 500);
            setSupportsColorTemp(true);
          }
        }
      }

      await loadDeviceArea();
    } catch (error) {
      console.error("Error loading device state:", error);
    } finally {
      setIsLoading(false);
      isInitialMount.current = false;
    }
  };

  const loadDeviceArea = async () => {
    try {
      const entityRegistry = await sendMessage({
        type: "config/entity_registry/list",
      });

      const deviceEntry = entityRegistry.find(
        (entry: any) => entry.entity_id === entity_id
      );

      if (deviceEntry?.area_id) {
        setCurrentAreaId(deviceEntry.area_id);
        const areaRegistry = await sendMessage({
          type: "config/area_registry/list",
        });
        const area = areaRegistry.find(
          (a: any) => a.area_id === deviceEntry.area_id
        );
        if (area) {
          setCurrentAreaName(area.name);
        }
      } else {
        setCurrentAreaId(null);
        setCurrentAreaName("None");
      }
    } catch (error) {
      console.error("Error loading device area:", error);
    }
  };

  const loadAreas = async () => {
    try {
      const areaRegistry = await sendMessage({
        type: "config/area_registry/list",
      });

      const formattedAreas: HAArea[] = areaRegistry.map((area: any) => ({
        area_id: area.area_id,
        name: area.name,
        picture: area.picture,
      }));

      setAreas(formattedAreas);
    } catch (error) {
      console.error("Error loading areas:", error);
    }
  };

  const toggleDevice = async () => {
    if (isToggling) return;

    const newState = state === "on" ? "off" : "on";
    const previousState = state;
    const previousBrightness = brightness;

    setState(newState);
    if (newState === "on" && entity_id.startsWith("light.")) {
      setBrightnessValue(previousBrightness || 100);
    }

    setIsToggling(true);

    try {
      const domain = entity_id.split(".")[0];
      const service = state === "on" ? "turn_off" : "turn_on";

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
      setState(previousState);
      setBrightnessValue(previousBrightness);
      Alert.alert("Error", "Failed to toggle device");
    } finally {
      setIsToggling(false);
    }
  };

  const updateBrightness = (value: number) => {
    setBrightnessValue(Math.round(value));
  };

  const setBrightness = async (value: number) => {
    try {
      const brightnessValue = Math.round((value / 100) * 255);

      await sendMessage({
        type: "call_service",
        domain: "light",
        service: "turn_on",
        service_data: {
          entity_id,
          brightness: brightnessValue,
        },
      });

      console.log(`💡 Setting brightness for ${entity_id} to ${value}%`);
    } catch (error) {
      console.error("Error setting brightness:", error);
      Alert.alert("Error", "Failed to set brightness");
    }
  };

  // ✅ Color temperature functions
  const setColorPreset = async (preset: "warm" | "neutral" | "cool") => {
    let targetMired: number;

    switch (preset) {
      case "warm":
        targetMired = maxColorTemp;
        break;
      case "cool":
        targetMired = minColorTemp;
        break;
      case "neutral":
        targetMired = Math.round((minColorTemp + maxColorTemp) / 2);
        break;
    }

    setColorTempValue(targetMired);

    try {
      await sendMessage({
        type: "call_service",
        domain: "light",
        service: "turn_on",
        service_data: {
          entity_id,
          color_temp: Math.round(targetMired),
          brightness: 255, // Max brightness
        },
      });

      // Also update brightness UI
      setBrightnessValue(100);

      console.log(`🎨 Set ${preset} preset for ${entity_id}`);
    } catch (error) {
      console.error("Error setting color temperature:", error);
      Alert.alert("Error", "Failed to set color temperature");
    }
  };

  const miredToKelvin = (mired: number): number => {
    return Math.round(1000000 / mired);
  };

  const getCurrentPreset = (): "warm" | "neutral" | "cool" | null => {
    if (!colorTemp) return null;

    const neutral = Math.round((minColorTemp + maxColorTemp) / 2);
    const tolerance = 20;

    if (Math.abs(colorTemp - maxColorTemp) < tolerance) return "warm";
    if (Math.abs(colorTemp - minColorTemp) < tolerance) return "cool";
    if (Math.abs(colorTemp - neutral) < tolerance) return "neutral";
    return null;
  };

  const handleSelectRoom = async (area: HAArea | null) => {
    try {
      setIsSaving(true);

      await sendMessage({
        type: "config/entity_registry/update",
        entity_id: entity_id,
        area_id: area?.area_id || null,
      });

      setCurrentAreaId(area?.area_id || null);
      setCurrentAreaName(area?.name || "None");
      setIsRoomModalVisible(false);

      console.log(`✅ Updated device area to:  ${area?.name || "None"}`);
    } catch (error) {
      console.error("Error updating device area:", error);
      Alert.alert("Error", "Failed to update device room.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!customName.trim()) {
      Alert.alert("Error", "Please enter a device name");
      return;
    }

    setIsSaving(true);
    try {
      await sendMessage({
        type: "config/entity_registry/update",
        entity_id: entity_id,
        name: customName.trim(),
      });

      console.log(`✅ Updated device name to:  ${customName.trim()}`);
      setEditMode(false);
    } catch (error) {
      console.error("Error updating device name:", error);
      Alert.alert("Error", "Failed to update device name.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    Alert.alert("Reset Name", "Do you want to reset the name to default?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setIsSaving(true);
          try {
            await sendMessage({
              type: "config/entity_registry/update",
              entity_id: entity_id,
              name: null,
            });

            await loadDeviceState();
            setEditMode(false);
          } catch (error) {
            console.error("Error resetting device name:", error);
            Alert.alert("Error", "Failed to reset device name.");
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  const getStatusDisplay = () => {
    if (state === "on") return "On";
    if (state === "off") return "Off";
    return state?.charAt(0).toUpperCase() + state?.slice(1) || "Unknown";
  };

  const getIconForEntity = (entity_id: string): string => {
    if (entity_id.startsWith("light.")) return "bulb-outline";
    if (entity_id.startsWith("switch.")) return "power-outline";
    if (entity_id.startsWith("fan.")) return "snow-outline";
    if (entity_id.startsWith("climate.")) return "thermometer-outline";
    return "cube-outline";
  };

  const isControllable = () => {
    const domain = entity_id.split(".")[0];
    return ["light", "switch", "fan"].includes(domain);
  };

  const isLight = () => entity_id.startsWith("light.");

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#0066FF" />
        <Text className="mt-4 text-gray-500">Loading...</Text>
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
      </View>
    );
  }

  const currentPreset = getCurrentPreset();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
    >
      <ScrollView className="flex-1">
        <View className="bg-gray-50 px-5 pb-4 pt-12">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              <Ionicons name="chevron-back" size={24} color="#1F2937" />
            </TouchableOpacity>

            <Text className="text-xl font-semibold text-gray-900">
              Device Details
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

        <View className="px-5 pb-6">
          {/* Device Header Card */}
          <View className="mb-6 overflow-hidden rounded-[28px] bg-blue-500 shadow-xl">
            <View className="p-6">
              <View className="flex-row items-center gap-4">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                  <Ionicons
                    name={getIconForEntity(entity_id) as any}
                    size={32}
                    color="white"
                  />
                </View>
                <View className="flex-1">
                  {editMode ? (
                    <View className="flex-row items-start gap-2">
                      <TextInput
                        value={customName}
                        onChangeText={setCustomName}
                        className="flex-1 rounded-xl border-2 border-white/50 bg-white/30 px-4 pb-2 text-lg font-bold text-white"
                        placeholderTextColor="#FFFFFF80"
                        placeholder="Device name"
                        onSubmitEditing={handleSave}
                        multiline
                        numberOfLines={2}
                        style={{
                          minHeight: 50,
                          textAlignVertical: "top",
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={isSaving}
                        className="mt-1 h-12 w-12 items-center justify-center rounded-full bg-white/30"
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons name="checkmark" size={24} color="white" />
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text className="text-xl font-bold text-white">
                        {customName}
                      </Text>
                      <Text className="mt-1 text-sm capitalize text-white/80">
                        {entity_id.split(".")[0]}
                        {supportsColorTemp && " • Dual Color"}
                      </Text>
                    </>
                  )}
                </View>
                {!editMode && (
                  <View
                    className={`rounded-full px-4 py-2 ${
                      state === "on" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-white">
                      {getStatusDisplay()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Quick Control Card */}
          {isControllable() && (
            <View className="mb-6 rounded-[28px] bg-white p-6 shadow-sm">
              <Text className="mb-4 text-lg font-bold text-gray-900">
                Quick Control
              </Text>

              <View className="flex-row items-center gap-4">
                <View
                  className={`h-16 w-16 items-center justify-center rounded-[20px] ${
                    state === "on" ? "bg-blue-100" : "bg-gray-100"
                  }`}
                >
                  <Ionicons
                    name={getIconForEntity(entity_id) as any}
                    size={32}
                    color={state === "on" ? "#0066FF" : "#9CA3AF"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-bold text-gray-900">Power</Text>
                  <Text className="mt-0.5 text-sm text-gray-500">
                    {state === "on" ? "Turn off device" : "Turn on device"}
                  </Text>
                </View>
                <Switch
                  value={state === "on"}
                  onValueChange={toggleDevice}
                  disabled={isToggling}
                  trackColor={{ false: "#E5E7EB", true: "#0066FF" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E7EB"
                />
              </View>

              {isLight() && state === "on" && (
                <View className="mt-5 gap-4">
                  {brightness !== undefined && (
                    <View>
                      <View className="mb-2 flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <Ionicons
                            name="sunny-outline"
                            size={18}
                            color="#6B7280"
                          />
                          <Text className="text-sm font-semibold text-gray-700">
                            Brightness
                          </Text>
                        </View>
                        <Text className="text-sm font-bold text-gray-900">
                          {brightness}%
                        </Text>
                      </View>

                      <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                          onPress={() => {
                            const newValue = Math.max(0, brightness - 10);
                            updateBrightness(newValue);
                            setBrightness(newValue);
                          }}
                          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                        >
                          <Ionicons name="remove" size={20} color="#6B7280" />
                        </TouchableOpacity>

                        <Slider
                          style={{ flex: 1, height: 40 }}
                          minimumValue={0}
                          maximumValue={100}
                          value={brightness}
                          onValueChange={updateBrightness}
                          onSlidingComplete={setBrightness}
                          minimumTrackTintColor="#0066FF"
                          maximumTrackTintColor="#E5E7EB"
                          thumbTintColor="#0066FF"
                        />

                        <TouchableOpacity
                          onPress={() => {
                            const newValue = Math.min(100, brightness + 10);
                            updateBrightness(newValue);
                            setBrightness(newValue);
                          }}
                          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                        >
                          <Ionicons name="add" size={20} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {supportsColorTemp && colorTemp !== undefined && (
                    <View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => setColorPreset("warm")}
                          className={`flex-1 items-center rounded-xl py-4 ${
                            currentPreset === "warm"
                              ? "bg-orange-500"
                              : "bg-orange-50"
                          }`}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="flame"
                            size={24}
                            color={
                              currentPreset === "warm" ? "#FFFFFF" : "#F97316"
                            }
                          />
                          <Text
                            className={`mt-2 text-xs font-bold ${
                              currentPreset === "warm"
                                ? "text-white"
                                : "text-orange-600"
                            }`}
                          >
                            Warm
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setColorPreset("neutral")}
                          className={`flex-1 items-center rounded-xl py-4 ${
                            currentPreset === "neutral"
                              ? "bg-gray-700"
                              : "bg-gray-50"
                          }`}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="sunny"
                            size={24}
                            color={
                              currentPreset === "neutral"
                                ? "#FFFFFF"
                                : "#6B7280"
                            }
                          />
                          <Text
                            className={`mt-2 text-xs font-bold ${
                              currentPreset === "neutral"
                                ? "text-white"
                                : "text-gray-600"
                            }`}
                          >
                            Neutral
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setColorPreset("cool")}
                          className={`flex-1 items-center rounded-xl py-4 ${
                            currentPreset === "cool"
                              ? "bg-blue-500"
                              : "bg-blue-50"
                          }`}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="snow"
                            size={24}
                            color={
                              currentPreset === "cool" ? "#FFFFFF" : "#0EA5E9"
                            }
                          />
                          <Text
                            className={`mt-2 text-xs font-bold ${
                              currentPreset === "cool"
                                ? "text-white"
                                : "text-blue-600"
                            }`}
                          >
                            Cool
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Device Information */}
          <View className="mb-6 rounded-[28px] bg-white p-6 shadow-sm">
            <Text className="mb-4 text-lg font-bold text-gray-900">
              Information
            </Text>

            <View className="gap-3">
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-gray-600">Entity ID</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {entity_id}
                </Text>
              </View>

              <View className="h-px bg-gray-200" />

              <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-gray-600">Type</Text>
                <Text className="text-sm font-semibold capitalize text-gray-900">
                  {entity_id.split(".")[0]}
                </Text>
              </View>

              <View className="h-px bg-gray-200" />

              <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-gray-600">Status</Text>
                <View className="flex-row items-center gap-2">
                  <View
                    className={`h-2 w-2 rounded-full ${
                      state === "on" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <Text
                    className={`text-sm font-semibold ${
                      state === "on" ? "text-green-600" : "text-gray-600"
                    }`}
                  >
                    {getStatusDisplay()}
                  </Text>
                </View>
              </View>

              <View className="h-px bg-gray-200" />

              <TouchableOpacity
                onPress={() => setIsRoomModalVisible(true)}
                className="flex-row items-center justify-between py-2"
              >
                <Text className="text-sm text-gray-600">Room</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-blue-600">
                    {currentAreaName}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#0066FF" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Reset Button */}
          {editMode && (
            <View className="mb-6 rounded-[28px] bg-white p-6 shadow-sm">
              <TouchableOpacity
                className="items-center rounded-2xl border-2 border-red-200 bg-red-50 p-4"
                onPress={handleReset}
                disabled={isSaving}
              >
                <Text className="text-base font-bold text-red-600">
                  Reset to Default Name
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Room Selection Modal */}
      <Modal
        visible={isRoomModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRoomModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[80%] rounded-t-[28px] bg-white">
            <View className="border-b border-gray-200 px-6 py-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-xl font-bold text-gray-900">
                  Select Room
                </Text>
                <TouchableOpacity
                  onPress={() => setIsRoomModalVisible(false)}
                  className="h-10 w-10 items-center justify-center rounded-full bg-gray-100"
                >
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="px-6 py-4">
              <TouchableOpacity
                onPress={() => handleSelectRoom(null)}
                className={`mb-3 flex-row items-center gap-4 rounded-2xl border-2 p-4 ${
                  currentAreaId === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-xl ${
                    currentAreaId === null ? "bg-blue-100" : "bg-gray-100"
                  }`}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={24}
                    color={currentAreaId === null ? "#0066FF" : "#9CA3AF"}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-semibold ${
                      currentAreaId === null ? "text-blue-600" : "text-gray-900"
                    }`}
                  >
                    No Room
                  </Text>
                  <Text className="text-sm text-gray-500">
                    Remove from all rooms
                  </Text>
                </View>
                {currentAreaId === null && (
                  <Ionicons name="checkmark-circle" size={24} color="#0066FF" />
                )}
              </TouchableOpacity>

              {areas.map((area) => (
                <TouchableOpacity
                  key={area.area_id}
                  onPress={() => handleSelectRoom(area)}
                  className={`mb-3 flex-row items-center gap-4 rounded-2xl border-2 p-4 ${
                    currentAreaId === area.area_id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <View
                    className={`h-12 w-12 items-center justify-center rounded-xl ${
                      currentAreaId === area.area_id
                        ? "bg-blue-100"
                        : "bg-gray-100"
                    }`}
                  >
                    <Ionicons
                      name="home-outline"
                      size={24}
                      color={
                        currentAreaId === area.area_id ? "#0066FF" : "#9CA3AF"
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-semibold ${
                        currentAreaId === area.area_id
                          ? "text-blue-600"
                          : "text-gray-900"
                      }`}
                    >
                      {area.name}
                    </Text>
                  </View>
                  {currentAreaId === area.area_id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color="#0066FF"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
