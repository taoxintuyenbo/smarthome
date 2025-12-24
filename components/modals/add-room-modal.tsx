import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
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

interface AddRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onRoomCreated: () => void;
  sendMessage: (message: any) => Promise<any>;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const AVAILABLE_ICONS: Array<{
  mdi: string;
  ionicon: IoniconsName;
  label: string;
}> = [
  { mdi: "mdi:bed", ionicon: "bed-outline", label: "Bedroom" },
  {
    mdi: "mdi:silverware-fork-knife",
    ionicon: "restaurant-outline",
    label: "Kitchen",
  },
  { mdi: "mdi:shower", ionicon: "water-outline", label: "Bathroom" },
  { mdi: "mdi:laptop", ionicon: "laptop-outline", label: "Office" },
  { mdi: "mdi:sofa", ionicon: "home-outline", label: "Living Room" },
  { mdi: "mdi:garage", ionicon: "car-outline", label: "Garage" },
  { mdi: "mdi:glass-wine", ionicon: "wine-outline", label: "Bar" },
  { mdi: "mdi:cube", ionicon: "cube-outline", label: "Storage" },
];

export default function AddRoomModal({
  visible,
  onClose,
  onRoomCreated,
  sendMessage,
}: AddRoomModalProps) {
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("mdi:sofa");
  const [isCreating, setIsCreating] = useState(false);

  const getIconColor = (icon: string) => {
    const colorMap: Record<string, string> = {
      "mdi:bed": "#EC4899",
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

  const getIconBgColor = (icon: string) => {
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

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert("Error", "Please enter a room name");
      return;
    }

    setIsCreating(true);
    try {
      await sendMessage({
        type: "config/area_registry/create",
        name: newRoomName.trim(),
        icon: selectedIcon,
      });

      console.log(`✅ Created room: ${newRoomName}`);

      // Reset state
      setNewRoomName("");
      setSelectedIcon("mdi:sofa");

      // Notify parent and close
      onRoomCreated();
      onClose();

      Alert.alert("Success", `Room "${newRoomName}" created successfully!`);
    } catch (error) {
      console.error("Error creating room:", error);
      Alert.alert("Error", "Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setNewRoomName("");
    setSelectedIcon("mdi:sofa");
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
          <View className="h-[85%] rounded-t-[32px] bg-white">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
              <TouchableOpacity
                onPress={handleClose}
                className="h-10 w-10 items-center justify-center"
              >
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-900">
                Create New Room
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
                {/* Room Name Input */}
                <View className="mb-6">
                  <Text className="mb-2 text-sm font-semibold text-gray-700">
                    Room Name <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="flex-row items-center gap-3 rounded-2xl bg-white px-4 py-4 border border-gray-200">
                    <Ionicons name="home-outline" size={24} color="#6B7280" />
                    <TextInput
                      value={newRoomName}
                      onChangeText={setNewRoomName}
                      placeholder="e.g., Living Room"
                      placeholderTextColor="#9CA3AF"
                      className="flex-1 text-base text-gray-900"
                      autoFocus
                    />
                  </View>
                </View>

                {/* Icon Selection */}
                <View className="mb-6">
                  <Text className="mb-3 text-sm font-semibold text-gray-700">
                    Choose Icon
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                  >
                    {AVAILABLE_ICONS.map((icon) => (
                      <TouchableOpacity
                        key={icon.mdi}
                        onPress={() => setSelectedIcon(icon.mdi)}
                        className={`items-center rounded-2xl p-3 ${
                          selectedIcon === icon.mdi
                            ? "bg-blue-100 border-2 border-blue-600"
                            : "bg-white border-2 border-gray-200"
                        }`}
                        style={{ width: 80 }}
                        activeOpacity={0.7}
                      >
                        <View
                          className="mb-2 h-12 w-12 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor:
                              selectedIcon === icon.mdi
                                ? getIconBgColor(icon.mdi)
                                : "#F3F4F6",
                          }}
                        >
                          <Ionicons
                            name={icon.ionicon}
                            size={24}
                            color={
                              selectedIcon === icon.mdi
                                ? getIconColor(icon.mdi)
                                : "#9CA3AF"
                            }
                          />
                        </View>
                        <Text
                          className={`text-center text-xs ${
                            selectedIcon === icon.mdi
                              ? "font-semibold text-blue-600"
                              : "text-gray-600"
                          }`}
                        >
                          {icon.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </ScrollView>

            {/* Footer Button */}
            <View className="border-t border-gray-200 bg-white px-6 py-4">
              <TouchableOpacity
                onPress={createRoom}
                disabled={isCreating || !newRoomName.trim()}
                className={`flex-row items-center justify-center gap-2 rounded-2xl px-6 py-4 ${
                  isCreating || !newRoomName.trim()
                    ? "bg-gray-400"
                    : "bg-blue-600"
                }`}
                activeOpacity={0.8}
              >
                {isCreating ? (
                  <Text className="text-base font-bold text-white">
                    Creating...
                  </Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="white" />
                    <Text className="text-base font-bold text-white">
                      Create Room
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
