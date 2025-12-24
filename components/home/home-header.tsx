import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

export function HomeHeader() {
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good Morning"
      : currentHour < 18
        ? "Good Afternoon"
        : "Good Evening";

  return (
    <View className="bg-gray-50 px-5 pb-4 pt-12">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {/* <View className="h-20 w-20 overflow-hidden rounded-full border-2 border-gray-200 bg-gray-300 items-center justify-center">
            <Ionicons name="person" size={40} color="#9CA3AF" />
          </View> */}
          <View>
            <Text className="text-sm text-gray-600">{greeting}</Text>
            <Text className="text-2xl font-bold text-gray-900">Nam Trung</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity className="h-12 w-12 items-center justify-center">
            <Ionicons name="search-outline" size={26} color="#1F2937" />
          </TouchableOpacity>
          <TouchableOpacity className="relative h-12 w-12 items-center justify-center">
            <Ionicons name="notifications-outline" size={26} color="#1F2937" />
            <View className="absolute right-3 top-3 h-2. 5 w-2.5 rounded-full bg-red-500" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
