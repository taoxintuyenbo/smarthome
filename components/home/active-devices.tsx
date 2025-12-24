import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useState } from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";

interface Device {
  id: number;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  room: string;
  brightness?: number;
  temp?: number;
  on: boolean;
}

const initialDevices: Device[] = [
  {
    id: 1,
    name: "Living Room Light",
    icon: "bulb-outline",
    room: "Living Room",
    brightness: 75,
    on: true,
  },
  {
    id: 2,
    name: "Air Conditioner",
    icon: "snow-outline",
    room: "Bedroom",
    temp: 22,
    on: true,
  },
  {
    id: 3,
    name: "Smart TV",
    icon: "tv-outline",
    room: "Living Room",
    on: false,
  },
  {
    id: 4,
    name: "HomePod",
    icon: "volume-high-outline",
    room: "Kitchen",
    on: true,
  },
];

export function ActiveDevices() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);

  const toggleDevice = (id: number) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, on: !d.on } : d))
    );
  };

  const updateBrightness = (id: number, value: number) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, brightness: Math.round(value) } : d
      )
    );
  };

  return (
    <View className="mb-6">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-800">Active Devices</Text>
        <TouchableOpacity>
          <Text className="text-sm font-semibold text-blue-600">See All</Text>
        </TouchableOpacity>
      </View>
      <View className="gap-4">
        {devices.map((device) => (
          <View
            key={device.id}
            className="rounded-[28px] bg-white p-5 shadow-sm"
          >
            <View className="flex-row items-center gap-4">
              <View
                className={`h-16 w-16 items-center justify-center rounded-[20px] ${
                  device.on ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <Ionicons
                  name={device.icon}
                  size={32}
                  color={device.on ? "#0066FF" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900">
                  {device.name}
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500">
                  {device.room}
                </Text>
              </View>
              <Switch
                value={device.on}
                onValueChange={() => toggleDevice(device.id)}
                trackColor={{ false: "#E5E7EB", true: "#0066FF" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E7EB"
              />
            </View>

            {/* Brightness Slider */}
            {device.on && device.brightness !== undefined && (
              <View className="mt-5 flex-row items-center gap-3 pl-1">
                <Slider
                  style={{ flex: 1, height: 40 }}
                  minimumValue={0}
                  maximumValue={100}
                  value={device.brightness}
                  onValueChange={(value) => updateBrightness(device.id, value)}
                  minimumTrackTintColor="#0066FF"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#0066FF"
                />
                <Text className="w-14 text-right text-base font-bold text-gray-600">
                  {device.brightness}%
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
