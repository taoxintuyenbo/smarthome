import { ScrollView, View } from "react-native";
import { ActiveDevices } from "../../components/home/active-devices";
import { HomeHeader } from "../../components/home/home-header";
import { QuickActions } from "../../components/home/quick-actions";
import { RoomOverview } from "../../components/home/room-overview";
import { WeatherCard } from "../../components/home/weather-card";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <HomeHeader />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-6">
          <WeatherCard />
          <QuickActions />
          <ActiveDevices />
          <RoomOverview />
        </View>
      </ScrollView>
    </View>
  );
}
