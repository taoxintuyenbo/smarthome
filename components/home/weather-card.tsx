import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export function WeatherCard() {
  return (
    <View className="mb-6 mt-2 overflow-hidden rounded-[32px] bg-blue-500 from-blue-500 to-cyan-400 p-6 shadow-xl shadow-blue-500/30">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View>
          <Text className="text-base font-medium text-white/90">My Home</Text>
          <View className="mt-2 flex-row items-baseline">
            <Text className="text-7xl font-bold text-white tracking-tight">
              24
            </Text>
            <Text className="text-3xl font-medium text-white ml-2">°C</Text>
          </View>
          <Text className="mt-3 text-base text-white/90">Partly Cloudy</Text>
        </View>
        <View className="mt-2">
          <Ionicons name="cloud-outline" size={64} color="white" />
        </View>
      </View>

      {/* Weather Details */}
      <View className="flex-row items-center gap-6 mb-6">
        <View className="flex-row items-center gap-2">
          <Ionicons name="water-outline" size={18} color="white" />
          <Text className="text-base font-medium text-white">45%</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="speedometer-outline" size={18} color="white" />
          <Text className="text-base font-medium text-white">12km/h</Text>
        </View>
      </View>

      {/* Stats Container */}
      <View className="flex-row items-center justify-around rounded-2xl bg-white/20 px-4 py-5">
        <View className="items-center">
          <Text className="text-sm font-medium text-white/80">Devices</Text>
          <Text className="mt-1 text-2xl font-bold text-white">24</Text>
        </View>
        <View className="h-10 w-px bg-white/30" />
        <View className="items-center">
          <Text className="text-sm font-medium text-white/80">Active</Text>
          <Text className="mt-1 text-2xl font-bold text-white">12</Text>
        </View>
        <View className="h-10 w-px bg-white/30" />
        <View className="items-center">
          <Text className="text-sm font-medium text-white/80">Power</Text>
          <Text className="mt-1 text-2xl font-bold text-white">2. 4kW</Text>
        </View>
      </View>
    </View>
  );
}
