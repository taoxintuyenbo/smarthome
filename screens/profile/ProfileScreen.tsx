import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-gray-50 px-5 pb-4 pt-12">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-gray-600">Welcome back</Text>
            <Text className="text-2xl font-bold text-gray-900">
              Profile & Settings
            </Text>
          </View>
          <TouchableOpacity className="h-12 w-12 items-center justify-center">
            <Ionicons name="settings-outline" size={26} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-8">
          {/* Profile Card */}
          <View className="mb-6 mt-2 overflow-hidden rounded-[28px] bg-blue-500 from-blue-500 to-cyan-400 p-6 shadow-xl">
            <View className="flex-row items-center gap-4">
              <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 bg-white/20">
                <Ionicons name="person" size={40} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-2xl font-bold text-white">Nam Trung</Text>
                <Text className="mt-0.5 text-xs text-white/80">
                  Member since 2025
                </Text>
              </View>
            </View>

            <View className="mt-5 flex-row items-center justify-around rounded-2xl bg-white/20 px-4 py-4">
              <View className="items-center">
                <Text className="text-sm font-medium text-white/80">
                  Devices
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">24</Text>
              </View>
              <View className="h-8 w-px bg-white/30" />
              <View className="items-center">
                <Text className="text-sm font-medium text-white/80">Rooms</Text>
                <Text className="mt-1 text-xl font-bold text-white">6</Text>
              </View>
              <View className="h-8 w-px bg-white/30" />
              <View className="items-center">
                <Text className="text-sm font-medium text-white/80">
                  Scenes
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">12</Text>
              </View>
            </View>
          </View>

          {/* Preferences Section */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-gray-800">
              Preferences
            </Text>
            <View className="gap-3">
              {/* My Home Preference */}
              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
                onPress={() => router.push("/profile/list-home")}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                    <Ionicons name="home-outline" size={24} color="#0066FF" />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      My Home
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Manage your homes
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-purple-100">
                    <Ionicons
                      name="notifications-outline"
                      size={24}
                      color="#A855F7"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Notifications
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Manage alerts & sounds
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pink-100">
                    <Ionicons
                      name="color-palette-outline"
                      size={24}
                      color="#EC4899"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Theme
                    </Text>
                    <Text className="text-sm text-gray-500">Light mode</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-green-100">
                    <Ionicons
                      name="language-outline"
                      size={24}
                      color="#10B981"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Language
                    </Text>
                    <Text className="text-sm text-gray-500">English (US)</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
                    <Ionicons
                      name="location-outline"
                      size={24}
                      color="#F97316"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Location
                    </Text>
                    <Text className="text-sm text-gray-500">
                      San Francisco, CA
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Section */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-gray-800">
              Security
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-red-100">
                    <Ionicons
                      name="lock-closed-outline"
                      size={24}
                      color="#EF4444"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Change Password
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Update your password
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
                    <Ionicons
                      name="finger-print-outline"
                      size={24}
                      color="#6366F1"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      Biometric Lock
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Face ID enabled
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Support & About Section */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold text-gray-800">
              Support & About
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100">
                    <Ionicons
                      name="help-circle-outline"
                      size={24}
                      color="#06B6D4"
                    />
                  </View>
                  <Text className="text-base font-semibold text-gray-900">
                    Help & Support
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pink-100">
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={24}
                      color="#EC4899"
                    />
                  </View>
                  <Text className="text-base font-semibold text-gray-900">
                    Privacy Policy
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100">
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color="#F59E0B"
                    />
                  </View>
                  <Text className="text-base font-semibold text-gray-900">
                    Terms of Service
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center justify-between rounded-[24px] bg-white p-5 shadow-sm"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                    <Ionicons
                      name="information-circle-outline"
                      size={24}
                      color="#6B7280"
                    />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">
                      About
                    </Text>
                    <Text className="text-sm text-gray-500">Version 1.0.0</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            className="rounded-[24px] bg-red-50 border-2 border-red-200 p-5 shadow-sm"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-center gap-3">
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              <Text className="text-base font-bold text-red-500">Logout</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
