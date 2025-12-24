import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface Action {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
}

const actions: Action[] = [
  { id: "lights", icon: "bulb-outline", label: "Lights", active: true },
  {
    id: "climate",
    icon: "thermometer-outline",
    label: "Climate",
    active: true,
  },
  { id: "security", icon: "lock-closed-outline", label: "Lock", active: false },
  {
    id: "alarm",
    icon: "shield-checkmark-outline",
    label: "Alarm",
    active: true,
  },
  { id: "wifi", icon: "wifi-outline", label: "WiFi", active: true },
  { id: "music", icon: "musical-notes-outline", label: "Music", active: false },
];

export function QuickActions() {
  const [actionStates, setActionStates] = useState<Record<string, boolean>>(
    actions.reduce(
      (acc, action) => ({ ...acc, [action.id]: action.active }),
      {}
    )
  );

  const toggleAction = (id: string) => {
    setActionStates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View className="mb-6">
      <Text className="mb-4 text-xl font-bold text-gray-800">
        Quick Actions
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {actions.map((action) => {
          const isActive = actionStates[action.id];
          return (
            <View key={action.id} className="w-[31%]">
              <TouchableOpacity
                onPress={() => toggleAction(action.id)}
                className={`aspect-square items-center justify-center gap-3 rounded-[28px] ${
                  isActive
                    ? "bg-blue-600 shadow-lg"
                    : "bg-white border-2 border-gray-100"
                }`}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={action.icon}
                  size={36}
                  color={isActive ? "#FFFFFF" : "#6B7280"}
                />
                <Text
                  className={`text-sm font-semibold ${
                    isActive ? "text-white" : "text-gray-900"
                  }`}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}
