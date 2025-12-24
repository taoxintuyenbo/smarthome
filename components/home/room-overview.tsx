import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface Room {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  devices: number;
  active: number;
  iconColor: string;
  bgColor: string;
}

const rooms: Room[] = [
  {
    id: "living",
    name: "Living Room",
    icon: "home-outline",
    devices: 8,
    active: 5,
    iconColor: "#0066FF",
    bgColor: "#DBEAFE",
  },
  {
    id: "bedroom",
    name: "Bedroom",
    icon: "bed-outline",
    devices: 6,
    active: 2,
    iconColor: "#0066FF",
    bgColor: "#DBEAFE",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    icon: "restaurant-outline",
    devices: 5,
    active: 3,
    iconColor: "#10B981",
    bgColor: "#D1FAE5",
  },
];

export function RoomOverview() {
  return (
    <View className="mb-6">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-800">Rooms</Text>
        <TouchableOpacity>
          <Text className="text-sm font-semibold text-blue-600">View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 px-5"
      >
        <View className="flex-row gap-4 pb-2">
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              className="w-48 rounded-[28px] bg-white p-6 shadow-sm"
              activeOpacity={0.8}
            >
              <View
                className="mb-5 h-16 w-16 items-center justify-center rounded-[20px]"
                style={{ backgroundColor: room.bgColor }}
              >
                <Ionicons name={room.icon} size={32} color={room.iconColor} />
              </View>
              <Text className="text-lg font-bold text-gray-900 mb-1">
                {room.name}
              </Text>
              <Text className="text-sm text-gray-500">
                <Text className="font-bold text-blue-600">{room.active}</Text> /{" "}
                {room.devices} on
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
