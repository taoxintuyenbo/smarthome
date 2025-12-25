import { HA_CONFIG, useHomeAssistant } from "@/contexts/HomeAssistantContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
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

const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon", fullName: "Monday" },
  { id: "tue", label: "Tue", fullName: "Tuesday" },
  { id: "wed", label: "Wed", fullName: "Wednesday" },
  { id: "thu", label: "Thu", fullName: "Thursday" },
  { id: "fri", label: "Fri", fullName: "Friday" },
  { id: "sat", label: "Sat", fullName: "Saturday" },
  { id: "sun", label: "Sun", fullName: "Sunday" },
];

interface AddAutomationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  roomId?: string;
  roomName?: string;
}

interface Device {
  entity_id: string;
  name: string;
  state: string;
  area_id?: string;
  selectedAction: "turn_on" | "turn_off" | null;
  brightness?: number;
  // ✅ Color temperature support
  colorTemp?: number;
  minColorTemp?: number;
  maxColorTemp?: number;
  supportsColorTemp?: boolean;
  colorPreset?: "warm" | "neutral" | "cool" | null;
}

interface Room {
  area_id: string;
  name: string;
  icon: string | null;
  deviceCount: number;
}

// Icon mapping functions
const mapIconToIonicons = (icon: string | null): any => {
  if (!icon) return "cube-outline";
  const iconMap: Record<string, string> = {
    "mdi: bed": "bed-outline",
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
    "mdi:silverware-fork-knife": "#D1FAE5",
    "mdi:shower": "#CFFAFE",
    "mdi:laptop": "#FEF3C7",
    "mdi:garage": "#F3F4F6",
    "mdi:glass-wine": "#EDE9FE",
    "mdi:sofa": "#DBEAFE",
    "mdi:cube": "#CCFBF1",
  };
  return colorMap[icon] || "#DBEAFE";
};

export function AddAutomationModal({
  visible,
  onClose,
  onSuccess,
  roomId,
  roomName,
}: AddAutomationModalProps) {
  const { sendMessage, isConnected } = useHomeAssistant();
  const [scenarioName, setScenarioName] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(
    new Set()
  );
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [enableTimer, setEnableTimer] = useState(false);
  const [triggerTime, setTriggerTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [timeInput, setTimeInput] = useState("");
  const [viewMode, setViewMode] = useState<"devices" | "rooms">("devices");

  useEffect(() => {
    if (visible && isConnected) {
      loadDevices();
    }
  }, [visible, isConnected]);

  useEffect(() => {
    setTimeInput(formatTime(triggerTime));
  }, [triggerTime]);

  useEffect(() => {
    if (roomId && visible) {
      setSelectedRooms(new Set([roomId]));
      setViewMode("rooms");
    }
  }, [roomId, visible]);

  const loadDevices = async () => {
    if (!isConnected) {
      console.log("Not connected to Home Assistant");
      return;
    }

    setIsLoading(true);

    try {
      const states = await sendMessage({ type: "get_states" });
      const entityRegistry = await sendMessage({
        type: "config/entity_registry/list",
      });
      const areas = await sendMessage({
        type: "config/area_registry/list",
      });

      console.log("📦 Loading devices for automation");

      const entityToArea = new Map<string, string>();
      entityRegistry.forEach((entry: any) => {
        if (entry.area_id) {
          entityToArea.set(entry.entity_id, entry.area_id);
        }
      });

      const deviceList: Device[] = states
        .filter(
          (entity: any) =>
            (entity.entity_id.startsWith("light.") ||
              entity.entity_id.startsWith("switch.") ||
              entity.entity_id.startsWith("fan.")) &&
            entity.state !== "unavailable"
        )
        .map((entity: any) => {
          const device: Device = {
            entity_id: entity.entity_id,
            name: entity.attributes?.friendly_name || entity.entity_id,
            state: entity.state,
            area_id: entityToArea.get(entity.entity_id),
            selectedAction: null,
            brightness: 255,
          };

          // ✅ Check for color temp support
          if (entity.entity_id.startsWith("light.") && entity.attributes) {
            const supportedModes =
              entity.attributes.supported_color_modes || [];
            device.supportsColorTemp = supportedModes.includes("color_temp");

            if (device.supportsColorTemp) {
              device.minColorTemp = entity.attributes.min_mireds || 153;
              device.maxColorTemp = entity.attributes.max_mireds || 500;
              device.colorPreset = null;
            }
          }

          return device;
        });

      const roomsList: Room[] = areas
        .map((area: any) => ({
          area_id: area.area_id,
          name: area.name,
          icon: area.icon || null,
          deviceCount: deviceList.filter((d) => d.area_id === area.area_id)
            .length,
        }))
        .filter((room: Room) => room.deviceCount > 0);

      console.log("✅ Devices loaded:", deviceList.length);
      console.log("✅ Rooms loaded:", roomsList.length);

      setDevices(deviceList);
      setRooms(roomsList);

      if (roomId) {
        const roomDevices = deviceList.filter((d) => d.area_id === roomId);
        setSelectedDevices(new Set(roomDevices.map((d) => d.entity_id)));
      }
    } catch (error) {
      console.error("Error loading devices:", error);
      Alert.alert("Error", "Failed to load devices");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRoomSelection = (areaId: string) => {
    const newSelectedRooms = new Set(selectedRooms);
    const newSelectedDevices = new Set(selectedDevices);
    const roomDevices = devices.filter((d) => d.area_id === areaId);

    if (newSelectedRooms.has(areaId)) {
      newSelectedRooms.delete(areaId);
      roomDevices.forEach((d) => {
        newSelectedDevices.delete(d.entity_id);
      });
      setDevices((prev) =>
        prev.map((d) =>
          d.area_id === areaId ? { ...d, selectedAction: null } : d
        )
      );
    } else {
      newSelectedRooms.add(areaId);
      roomDevices.forEach((d) => {
        newSelectedDevices.add(d.entity_id);
      });
    }

    setSelectedRooms(newSelectedRooms);
    setSelectedDevices(newSelectedDevices);
  };

  const setRoomAction = (areaId: string, action: "turn_on" | "turn_off") => {
    setDevices((prev) =>
      prev.map((d) =>
        d.area_id === areaId ? { ...d, selectedAction: action } : d
      )
    );
  };

  const toggleDeviceSelection = (entityId: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(entityId)) {
      newSelected.delete(entityId);
      setDevices((prev) =>
        prev.map((d) =>
          d.entity_id === entityId
            ? { ...d, selectedAction: null, colorPreset: null }
            : d
        )
      );
    } else {
      newSelected.add(entityId);
    }
    setSelectedDevices(newSelected);
  };

  const setDeviceAction = (
    entityId: string,
    action: "turn_on" | "turn_off"
  ) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.entity_id === entityId ? { ...d, selectedAction: action } : d
      )
    );
  };

  const setDeviceBrightness = (entityId: string, brightness: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.entity_id === entityId ? { ...d, brightness } : d))
    );
  };

  // ✅ Set device color preset
  const setDeviceColorPreset = (
    entityId: string,
    preset: "warm" | "neutral" | "cool"
  ) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.entity_id === entityId
          ? { ...d, colorPreset: d.colorPreset === preset ? null : preset }
          : d
      )
    );
  };

  const isLight = (entityId: string) => entityId.startsWith("light.");

  const toggleDay = (dayId: string) => {
    const newDays = new Set(selectedDays);
    if (newDays.has(dayId)) {
      newDays.delete(dayId);
    } else {
      newDays.add(dayId);
    }
    setSelectedDays(newDays);
  };

  const selectAllDays = () => {
    setSelectedDays(new Set(DAYS_OF_WEEK.map((d) => d.id)));
  };

  const selectWeekdays = () => {
    setSelectedDays(new Set(["mon", "tue", "wed", "thu", "fri"]));
  };

  const selectWeekends = () => {
    setSelectedDays(new Set(["sat", "sun"]));
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setTriggerTime(selectedDate);
    }
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatTimeWithSeconds = (date: Date): string => {
    return `${formatTime(date)}:00`;
  };

  const handleTimeInputChange = (text: string) => {
    const cleaned = text.replace(/[^0-9:]/g, "");

    if (cleaned.length <= 5) {
      setTimeInput(cleaned);

      if (cleaned.length === 5 && cleaned.includes(":")) {
        const parts = cleaned.split(":");
        if (parts.length === 2) {
          const hours = parseInt(parts[0]);
          const minutes = parseInt(parts[1]);

          if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            const newDate = new Date(triggerTime);
            newDate.setHours(hours);
            newDate.setMinutes(minutes);
            setTriggerTime(newDate);
          }
        }
      }
    }
  };

  const miredToKelvin = (mired: number) => Math.round(1000000 / mired);

  const createAutomationInHA = async (
    automationId: string,
    alias: string,
    triggerTime: string,
    selectedDays: Set<string>,
    actions: any[]
  ) => {
    try {
      const baseUrl = HA_CONFIG.URL.replace("ws://", "http://").replace(
        "/api/websocket",
        ""
      );

      const automationConfig: any = {
        id: automationId,
        alias: alias,
        trigger: [
          {
            platform: "time",
            at: triggerTime,
          },
        ],
        action: actions,
        mode: "single",
      };

      if (selectedDays.size > 0 && selectedDays.size < 7) {
        automationConfig.condition = [
          {
            condition: "time",
            weekday: Array.from(selectedDays),
          },
        ];
      }

      console.log("📤 Creating automation in HA:", automationConfig);

      const response = await fetch(
        `${baseUrl}/api/config/automation/config/${automationId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HA_CONFIG.TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(automationConfig),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Automation created in HA:", result);
      return result;
    } catch (error) {
      console.error("❌ Error creating automation in HA:", error);
      throw error;
    }
  };

  const handleAddAutomation = async () => {
    if (!scenarioName.trim()) {
      Alert.alert("Error", "Please enter an automation name");
      return;
    }

    if (selectedDevices.size === 0) {
      Alert.alert("Error", "Please select at least one device or room");
      return;
    }

    const selectedDeviceList = devices.filter((d) =>
      selectedDevices.has(d.entity_id)
    );
    const missingActions = selectedDeviceList.filter((d) => !d.selectedAction);

    if (missingActions.length > 0) {
      Alert.alert("Error", "Please set actions for all selected devices/rooms");
      return;
    }

    if (enableTimer && selectedDays.size === 0) {
      Alert.alert("Error", "Please select at least one day for the automation");
      return;
    }

    setIsSaving(true);

    try {
      const automationId = `automation_${Date.now()}_${scenarioName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")}`;

      const actions: any[] = selectedDeviceList.map((device) => {
        const domain = device.entity_id.split(".")[0];
        const action: any = {
          service: `${domain}.${device.selectedAction}`,
          target: {
            entity_id: device.entity_id,
          },
        };

        // ✅ Add brightness and color temp for lights turning on
        if (domain === "light" && device.selectedAction === "turn_on") {
          action.data = {};

          if (device.brightness) {
            action.data.brightness = device.brightness;
          }

          // ✅ Add color temperature if preset is selected
          if (device.supportsColorTemp && device.colorPreset) {
            const { minColorTemp, maxColorTemp } = device;
            let targetMired: number;

            switch (device.colorPreset) {
              case "warm":
                targetMired = maxColorTemp || 500;
                break;
              case "cool":
                targetMired = minColorTemp || 153;
                break;
              case "neutral":
                targetMired = Math.round(
                  ((minColorTemp || 153) + (maxColorTemp || 500)) / 2
                );
                break;
            }

            action.data.color_temp = targetMired;
          }
        }

        return action;
      });

      if (enableTimer) {
        await createAutomationInHA(
          automationId,
          scenarioName,
          formatTimeWithSeconds(triggerTime),
          selectedDays,
          actions
        );

        console.log("✅ Time-based automation created in HA");

        Alert.alert(
          "Success",
          `Automation "${scenarioName}" created!\n\n${selectedDevices.size} devices will run at ${formatTime(
            triggerTime
          )} on ${
            selectedDays.size === 7
              ? "every day"
              : Array.from(selectedDays)
                  .map((id) => DAYS_OF_WEEK.find((d) => d.id === id)?.label)
                  .join(", ")
          }. `
        );
      } else {
        Alert.alert(
          "Info",
          "Manual scenarios are not yet supported.\nPlease enable scheduling to create automation."
        );
        setIsSaving(false);
        return;
      }

      setScenarioName("");
      setSelectedDevices(new Set());
      setSelectedRooms(new Set());
      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          selectedAction: null,
          brightness: 255,
          colorPreset: null,
        }))
      );
      setEnableTimer(false);
      setTriggerTime(new Date());
      setSelectedDays(new Set());
      setTimeInput("");
      setViewMode("devices");

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating automation:", error);
      Alert.alert("Error", `Failed to create automation.\n\n${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setScenarioName("");
    setSelectedDevices(new Set());
    setSelectedRooms(new Set());
    setDevices((prev) =>
      prev.map((d) => ({
        ...d,
        selectedAction: null,
        brightness: 255,
        colorPreset: null,
      }))
    );
    setEnableTimer(false);
    setTriggerTime(new Date());
    setSelectedDays(new Set());
    setTimeInput("");
    setViewMode("devices");
    onClose();
  };

  const getIconForEntity = (entity_id: string): string => {
    if (entity_id.startsWith("light.")) return "bulb-outline";
    if (entity_id.startsWith("switch.")) return "power-outline";
    if (entity_id.startsWith("fan.")) return "snow-outline";
    return "cube-outline";
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
                {roomName ? `Automate ${roomName}` : "Create Automation"}
              </Text>
              <View className="h-10 w-10" />
            </View>

            {!isConnected ? (
              <View className="flex-1 items-center justify-center">
                <Ionicons
                  name="cloud-offline-outline"
                  size={64}
                  color="#D1D5DB"
                />
                <Text className="mt-4 text-gray-500">
                  Not connected to Home Assistant
                </Text>
              </View>
            ) : isLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#0066FF" />
                <Text className="mt-4 text-gray-500">Loading devices...</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  className="flex-1 bg-gray-50"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <View className="px-6 py-6">
                    {/* Automation Name */}
                    <View className="mb-6">
                      <Text className="mb-2 text-sm font-semibold text-gray-700">
                        Automation Name
                      </Text>
                      <TextInput
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 shadow-sm"
                        placeholder="e.g., Morning Lights, Evening Routine"
                        placeholderTextColor="#9CA3AF"
                        value={scenarioName}
                        onChangeText={setScenarioName}
                      />
                    </View>

                    {/* Time Automation Toggle */}
                    <View className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
                      <View className="mb-3 flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-gray-900">
                            Schedule Automation
                          </Text>
                          <Text className="mt-1 text-sm text-gray-500">
                            Run automatically at specific time
                          </Text>
                        </View>
                        <Switch
                          value={enableTimer}
                          onValueChange={setEnableTimer}
                          trackColor={{ false: "#E5E7EB", true: "#0066FF" }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#E5E7EB"
                        />
                      </View>

                      {enableTimer && (
                        <View className="border-t border-gray-100 pt-3">
                          <Text className="mb-2 text-sm font-medium text-gray-700">
                            Trigger Time
                          </Text>

                          <View className="mb-4 flex-row items-center gap-3">
                            <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                              <Ionicons
                                name="time-outline"
                                size={20}
                                color="#0066FF"
                              />
                              <TextInput
                                className="flex-1 text-base font-semibold text-blue-900"
                                placeholder="HH:MM"
                                placeholderTextColor="#60A5FA"
                                value={timeInput}
                                onChangeText={handleTimeInputChange}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                              />
                            </View>

                            <TouchableOpacity
                              onPress={() => setShowTimePicker(!showTimePicker)}
                              className="h-12 w-12 items-center justify-center rounded-xl bg-blue-600"
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name="calendar-outline"
                                size={24}
                                color="white"
                              />
                            </TouchableOpacity>
                          </View>

                          {Platform.OS === "ios" && showTimePicker && (
                            <View className="mb-4 overflow-hidden rounded-xl bg-white">
                              <DateTimePicker
                                value={triggerTime}
                                mode="time"
                                is24Hour={true}
                                display="spinner"
                                onChange={onTimeChange}
                                textColor="#000000"
                              />
                              <TouchableOpacity
                                onPress={() => setShowTimePicker(false)}
                                className="bg-blue-600 py-3"
                              >
                                <Text className="text-center text-base font-semibold text-white">
                                  Done
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {Platform.OS === "android" && showTimePicker && (
                            <DateTimePicker
                              value={triggerTime}
                              mode="time"
                              is24Hour={true}
                              display="default"
                              onChange={onTimeChange}
                            />
                          )}

                          <Text className="mb-2 text-sm font-medium text-gray-700">
                            Repeat On
                          </Text>

                          <View className="mb-3 flex-row gap-2">
                            <TouchableOpacity
                              onPress={selectAllDays}
                              className="flex-1 rounded-lg bg-blue-50 px-3 py-2"
                            >
                              <Text className="text-center text-xs font-semibold text-blue-700">
                                Every Day
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={selectWeekdays}
                              className="flex-1 rounded-lg bg-blue-50 px-3 py-2"
                            >
                              <Text className="text-center text-xs font-semibold text-blue-700">
                                Weekdays
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={selectWeekends}
                              className="flex-1 rounded-lg bg-blue-50 px-3 py-2"
                            >
                              <Text className="text-center text-xs font-semibold text-blue-700">
                                Weekends
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View className="flex-row flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <TouchableOpacity
                                key={day.id}
                                onPress={() => toggleDay(day.id)}
                                className={`min-w-[60px] flex-1 items-center rounded-xl px-3 py-2.5 ${
                                  selectedDays.has(day.id)
                                    ? "bg-blue-600"
                                    : "bg-gray-100"
                                }`}
                              >
                                <Text
                                  className={`text-sm font-semibold ${
                                    selectedDays.has(day.id)
                                      ? "text-white"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {day.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          {selectedDays.size > 0 && (
                            <View className="mt-2 rounded-lg bg-blue-50 px-3 py-2">
                              <Text className="text-xs text-blue-700">
                                {selectedDays.size === 7
                                  ? "Repeats every day"
                                  : `Repeats on ${Array.from(selectedDays)
                                      .map(
                                        (id) =>
                                          DAYS_OF_WEEK.find((d) => d.id === id)
                                            ?.fullName
                                      )
                                      .join(", ")}`}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* View Toggle */}
                    {!roomId && (
                      <View className="mb-4 flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => setViewMode("devices")}
                          className={`flex-1 rounded-xl py-3 ${
                            viewMode === "devices"
                              ? "bg-blue-600"
                              : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-center text-sm font-semibold ${
                              viewMode === "devices"
                                ? "text-white"
                                : "text-gray-600"
                            }`}
                          >
                            By Device
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setViewMode("rooms")}
                          className={`flex-1 rounded-xl py-3 ${
                            viewMode === "rooms" ? "bg-blue-600" : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-center text-sm font-semibold ${
                              viewMode === "rooms"
                                ? "text-white"
                                : "text-gray-600"
                            }`}
                          >
                            By Room
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Selection Header */}
                    <View className="mb-4 flex-row items-center justify-between">
                      <Text className="text-lg font-bold text-gray-800">
                        {viewMode === "rooms"
                          ? "Select Rooms"
                          : "Select Devices"}
                      </Text>
                      <Text className="text-sm font-semibold text-blue-600">
                        {viewMode === "rooms"
                          ? `${selectedRooms.size} rooms, ${selectedDevices.size} devices`
                          : `${selectedDevices.size} selected`}
                      </Text>
                    </View>

                    {/* ROOMS VIEW */}
                    {viewMode === "rooms" && (
                      <View className="gap-4">
                        {rooms.map((room) => {
                          const isRoomSelected = selectedRooms.has(
                            room.area_id
                          );
                          const roomDevices = devices.filter(
                            (d) => d.area_id === room.area_id
                          );
                          const selectedRoomAction =
                            roomDevices[0]?.selectedAction;

                          const ioniconsName = mapIconToIonicons(room.icon);
                          const iconColor = getIconColor(room.icon);
                          const iconBgColor = getIconBgColor(room.icon);

                          return (
                            <View
                              key={room.area_id}
                              className="rounded-[24px] bg-white p-4 shadow-sm"
                            >
                              <TouchableOpacity
                                onPress={() =>
                                  toggleRoomSelection(room.area_id)
                                }
                                activeOpacity={0.7}
                              >
                                <View className="flex-row items-center gap-3">
                                  <View
                                    className={`h-6 w-6 items-center justify-center rounded-lg border-2 ${
                                      isRoomSelected
                                        ? "border-blue-600 bg-blue-600"
                                        : "border-gray-300 bg-white"
                                    }`}
                                  >
                                    {isRoomSelected && (
                                      <Ionicons
                                        name="checkmark"
                                        size={16}
                                        color="white"
                                      />
                                    )}
                                  </View>

                                  <View
                                    className="h-14 w-14 items-center justify-center rounded-2xl"
                                    style={{ backgroundColor: iconBgColor }}
                                  >
                                    <Ionicons
                                      name={ioniconsName}
                                      size={28}
                                      color={iconColor}
                                    />
                                  </View>

                                  <View className="flex-1">
                                    <Text className="text-base font-semibold text-gray-900">
                                      {room.name}
                                    </Text>
                                    <Text className="text-xs text-gray-500">
                                      {room.deviceCount} devices
                                    </Text>
                                  </View>
                                </View>
                              </TouchableOpacity>

                              {isRoomSelected && (
                                <View className="mt-3 border-t border-gray-100 pt-3">
                                  <Text className="mb-2 text-xs font-medium text-gray-700">
                                    Action for all devices in room
                                  </Text>
                                  <View className="flex-row gap-2">
                                    <TouchableOpacity
                                      onPress={() =>
                                        setRoomAction(room.area_id, "turn_on")
                                      }
                                      className={`flex-1 rounded-xl py-2.5 ${
                                        selectedRoomAction === "turn_on"
                                          ? "bg-green-500"
                                          : "bg-gray-100"
                                      }`}
                                    >
                                      <Text
                                        className={`text-center text-sm font-semibold ${
                                          selectedRoomAction === "turn_on"
                                            ? "text-white"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        Turn ALL ON
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() =>
                                        setRoomAction(room.area_id, "turn_off")
                                      }
                                      className={`flex-1 rounded-xl py-2.5 ${
                                        selectedRoomAction === "turn_off"
                                          ? "bg-red-500"
                                          : "bg-gray-100"
                                      }`}
                                    >
                                      <Text
                                        className={`text-center text-sm font-semibold ${
                                          selectedRoomAction === "turn_off"
                                            ? "text-white"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        Turn ALL OFF
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* DEVICES VIEW */}
                    {viewMode === "devices" && (
                      <View className="gap-4">
                        {devices.map((device) => {
                          const isSelected = selectedDevices.has(
                            device.entity_id
                          );

                          return (
                            <View
                              key={device.entity_id}
                              className="rounded-[24px] bg-white p-4 shadow-sm"
                            >
                              <TouchableOpacity
                                onPress={() =>
                                  toggleDeviceSelection(device.entity_id)
                                }
                                activeOpacity={0.7}
                              >
                                <View className="flex-row items-center gap-3">
                                  <View
                                    className={`h-6 w-6 items-center justify-center rounded-lg border-2 ${
                                      isSelected
                                        ? "border-blue-600 bg-blue-600"
                                        : "border-gray-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && (
                                      <Ionicons
                                        name="checkmark"
                                        size={16}
                                        color="white"
                                      />
                                    )}
                                  </View>

                                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                                    <Ionicons
                                      name={
                                        getIconForEntity(
                                          device.entity_id
                                        ) as any
                                      }
                                      size={24}
                                      color="#0066FF"
                                    />
                                  </View>

                                  <View className="flex-1">
                                    <Text className="text-base font-semibold text-gray-900">
                                      {device.name}
                                    </Text>
                                    <Text className="text-xs capitalize text-gray-500">
                                      {device.entity_id.split(".")[0]}
                                      {device.supportsColorTemp &&
                                        " • Dual Color"}
                                    </Text>
                                  </View>
                                </View>
                              </TouchableOpacity>

                              {isSelected && (
                                <View className="mt-3 border-t border-gray-100 pt-3">
                                  <Text className="mb-2 text-xs font-medium text-gray-700">
                                    Action
                                  </Text>
                                  <View className="flex-row gap-2">
                                    <TouchableOpacity
                                      onPress={() =>
                                        setDeviceAction(
                                          device.entity_id,
                                          "turn_on"
                                        )
                                      }
                                      className={`flex-1 rounded-xl py-2.5 ${
                                        device.selectedAction === "turn_on"
                                          ? "bg-green-500"
                                          : "bg-gray-100"
                                      }`}
                                    >
                                      <Text
                                        className={`text-center text-sm font-semibold ${
                                          device.selectedAction === "turn_on"
                                            ? "text-white"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        Turn ON
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() =>
                                        setDeviceAction(
                                          device.entity_id,
                                          "turn_off"
                                        )
                                      }
                                      className={`flex-1 rounded-xl py-2.5 ${
                                        device.selectedAction === "turn_off"
                                          ? "bg-red-500"
                                          : "bg-gray-100"
                                      }`}
                                    >
                                      <Text
                                        className={`text-center text-sm font-semibold ${
                                          device.selectedAction === "turn_off"
                                            ? "text-white"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        Turn OFF
                                      </Text>
                                    </TouchableOpacity>
                                  </View>

                                  {isLight(device.entity_id) &&
                                    device.selectedAction === "turn_on" && (
                                      <>
                                        {/* Brightness Control */}
                                        <View className="mt-3 rounded-xl bg-blue-50 p-3">
                                          <View className="mb-2 flex-row items-center justify-between">
                                            <View className="flex-row items-center gap-2">
                                              <Ionicons
                                                name="sunny"
                                                size={16}
                                                color="#0066FF"
                                              />
                                              <Text className="text-xs font-semibold text-blue-800">
                                                Brightness
                                              </Text>
                                            </View>
                                            <Text className="text-xs font-bold text-blue-900">
                                              {Math.round(
                                                ((device.brightness || 255) /
                                                  255) *
                                                  100
                                              )}
                                              %
                                            </Text>
                                          </View>
                                          <Slider
                                            value={device.brightness || 255}
                                            onValueChange={(value) =>
                                              setDeviceBrightness(
                                                device.entity_id,
                                                Math.round(value)
                                              )
                                            }
                                            minimumValue={1}
                                            maximumValue={255}
                                            step={1}
                                            minimumTrackTintColor="#0066FF"
                                            maximumTrackTintColor="#E5E7EB"
                                            thumbTintColor="#0066FF"
                                          />
                                        </View>

                                        {/* ✅ Color Temperature Control */}
                                        {device.supportsColorTemp && (
                                          <View className="mt-3">
                                            <Text className="mb-2 text-xs font-medium text-gray-700">
                                              Color Mode (Optional)
                                            </Text>
                                            <View className="flex-row gap-2">
                                              <TouchableOpacity
                                                onPress={() =>
                                                  setDeviceColorPreset(
                                                    device.entity_id,
                                                    "warm"
                                                  )
                                                }
                                                className={`flex-1 items-center rounded-xl py-3 ${
                                                  device.colorPreset === "warm"
                                                    ? "bg-orange-500"
                                                    : "bg-orange-50"
                                                }`}
                                              >
                                                <Ionicons
                                                  name="flame"
                                                  size={20}
                                                  color={
                                                    device.colorPreset ===
                                                    "warm"
                                                      ? "#FFFFFF"
                                                      : "#F97316"
                                                  }
                                                />
                                                <Text
                                                  className={`mt-1 text-xs font-bold ${
                                                    device.colorPreset ===
                                                    "warm"
                                                      ? "text-white"
                                                      : "text-orange-600"
                                                  }`}
                                                >
                                                  Warm
                                                </Text>
                                              </TouchableOpacity>

                                              <TouchableOpacity
                                                onPress={() =>
                                                  setDeviceColorPreset(
                                                    device.entity_id,
                                                    "neutral"
                                                  )
                                                }
                                                className={`flex-1 items-center rounded-xl py-3 ${
                                                  device.colorPreset ===
                                                  "neutral"
                                                    ? "bg-gray-700"
                                                    : "bg-gray-50"
                                                }`}
                                              >
                                                <Ionicons
                                                  name="sunny"
                                                  size={20}
                                                  color={
                                                    device.colorPreset ===
                                                    "neutral"
                                                      ? "#FFFFFF"
                                                      : "#6B7280"
                                                  }
                                                />
                                                <Text
                                                  className={`mt-1 text-xs font-bold ${
                                                    device.colorPreset ===
                                                    "neutral"
                                                      ? "text-white"
                                                      : "text-gray-600"
                                                  }`}
                                                >
                                                  Neutral
                                                </Text>
                                              </TouchableOpacity>

                                              <TouchableOpacity
                                                onPress={() =>
                                                  setDeviceColorPreset(
                                                    device.entity_id,
                                                    "cool"
                                                  )
                                                }
                                                className={`flex-1 items-center rounded-xl py-3 ${
                                                  device.colorPreset === "cool"
                                                    ? "bg-blue-500"
                                                    : "bg-blue-50"
                                                }`}
                                              >
                                                <Ionicons
                                                  name="snow"
                                                  size={20}
                                                  color={
                                                    device.colorPreset ===
                                                    "cool"
                                                      ? "#FFFFFF"
                                                      : "#0EA5E9"
                                                  }
                                                />
                                                <Text
                                                  className={`mt-1 text-xs font-bold ${
                                                    device.colorPreset ===
                                                    "cool"
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
                                      </>
                                    )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </ScrollView>

                {/* Create Button */}
                <View className="border-t border-gray-200 bg-white px-6 py-4 pb-8">
                  <TouchableOpacity
                    onPress={handleAddAutomation}
                    disabled={isSaving}
                    className={`rounded-2xl py-4 ${
                      isSaving ? "bg-blue-300" : "bg-blue-600"
                    }`}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-center text-base font-semibold text-white">
                        Create in Home Assistant
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
