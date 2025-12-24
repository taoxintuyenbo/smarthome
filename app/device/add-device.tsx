import { useHomeAssistant } from "@/contexts/HomeAssistantContext";
import { Ionicons } from "@expo/vector-icons";
import { Buffer } from "buffer";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { BleManager, Device, State } from "react-native-ble-plx";

interface SmartDevice {
  id: string;
  name: string;
  rssi: number;
  isConnectable: boolean;
  serviceUUIDs?: string[];
}

interface DiscoveredUUIDs {
  serviceUUID: string;
  characteristicUUID: string;
}

interface ExistingDevice {
  entity_id: string;
  name: string;
  state: string;
  attributes: any;
}

export default function AddDeviceScreen() {
  const router = useRouter();
  const { sendMessage, isConnected } = useHomeAssistant();

  const bleManager = useMemo(() => new BleManager(), []);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Map<string, SmartDevice>>(new Map());
  const [bluetoothState, setBluetoothState] = useState<State>(State.Unknown);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Existing devices from HA
  const [existingDevices, setExistingDevices] = useState<ExistingDevice[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // WiFi Setup Modal
  const [showWiFiModal, setShowWiFiModal] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [settingUpWiFi, setSettingUpWiFi] = useState(false);

  // Loading state
  const [connecting, setConnecting] = useState(false);
  const [connectingDeviceName, setConnectingDeviceName] = useState("");
  const [discoveredUUIDs, setDiscoveredUUIDs] =
    useState<DiscoveredUUIDs | null>(null);

  useEffect(() => {
    let stateSub: { remove: () => void } | null = null;

    const init = async () => {
      const st = await bleManager.state();
      setBluetoothState(st);

      stateSub = bleManager.onStateChange((s) => {
        setBluetoothState(s);
      }, true);

      const ok = await requestPermissions();
      setPermissionGranted(ok);
    };

    init();

    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      bleManager.stopDeviceScan();
      stateSub?.remove();
      bleManager.destroy();
    };
  }, [bleManager]);

  // Load existing ESP devices from Home Assistant
  useEffect(() => {
    if (isConnected) {
      loadExistingDevices();
    }
  }, [isConnected]);

  const loadExistingDevices = async () => {
    if (!isConnected) return;

    setLoadingExisting(true);
    try {
      const states = await sendMessage({ type: "get_states" });

      // Find ESP devices with factory reset buttons (only available ones)
      const espDevices = states
        .filter((entity: any) => {
          // Look for button entities with "factory_reset" or "reset" in the name
          if (!entity.entity_id.startsWith("button.")) return false;

          // Skip unavailable devices
          if (entity.state === "unavailable" || entity.state === "unknown")
            return false;

          const name = (
            entity.attributes?.friendly_name || entity.entity_id
          ).toLowerCase();
          return name.includes("factory") && name.includes("reset");
        })
        .map((entity: any) => {
          // Extract device name from button entity
          // e.g., "button.esp32_test_factory_reset" -> "ESP32 Test"
          const friendlyName = entity.attributes?.friendly_name || "";
          const entityId = entity.entity_id
            .replace("button.", "")
            .replace("_factory_reset", "")
            .replace("_", " ");

          // Use friendly name but remove factory reset text
          let deviceName = friendlyName
            .replace("Factory Reset", "")
            .replace("(Change WiFi)", "")
            .trim();

          // If name is empty after cleanup, use entity ID
          if (!deviceName) {
            deviceName = entityId
              .split("_")
              .map(
                (word: string) => word.charAt(0).toUpperCase() + word.slice(1)
              )
              .join(" ");
          }

          return {
            entity_id: entity.entity_id,
            name: deviceName,
            state: entity.state,
            attributes: entity.attributes,
          };
        });

      console.log(
        "📱 Found ESP devices with factory reset:",
        espDevices.length
      );
      setExistingDevices(espDevices);
    } catch (error) {
      console.error("Error loading existing devices:", error);
    } finally {
      setLoadingExisting(false);
    }
  };

  const factoryResetDevice = async (device: ExistingDevice) => {
    Alert.alert(
      "Factory Reset",
      `Are you sure you want to factory reset "${device.name}"?\n\nThis will:\n• Erase WiFi settings\n• Restart the device\n• Put it in setup mode\n\nYou'll need to reconfigure WiFi after this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await sendMessage({
                type: "call_service",
                domain: "button",
                service: "press",
                service_data: {
                  entity_id: device.entity_id,
                },
              });

              Alert.alert(
                "Success",
                "Factory reset triggered! The device will restart and enter setup mode. You can now scan for it in the Bluetooth section below."
              );

              // Reload existing devices after a delay
              setTimeout(() => {
                loadExistingDevices();
              }, 2000);
            } catch (error) {
              console.error("Error resetting device:", error);
              Alert.alert("Error", "Failed to trigger factory reset");
            }
          },
        },
      ]
    );
  };

  const IMPROV_SERVICE_UUID = "00467768-6228-2272-4663-277478268000";
  const IMPROV_RPC_CHAR_UUID = "00467768-6228-2272-4663-277478268003";

  function checksumLSB(bytes: Buffer) {
    let sum = 0;
    for (const b of bytes) sum = (sum + b) & 0xff;
    return sum;
  }

  function buildImprovWifiPayload(ssid: string, password: string) {
    const ssidBytes = Buffer.from(ssid, "utf8");
    const passBytes = Buffer.from(password, "utf8");

    if (ssidBytes.length === 0) throw new Error("SSID is empty");
    if (ssidBytes.length > 32) throw new Error("SSID too long (max 32 bytes)");
    if (passBytes.length > 64)
      throw new Error("Password too long (max 64 bytes)");

    const dataLen = 1 + ssidBytes.length + 1 + passBytes.length;

    const packetNoCs = Buffer.concat([
      Buffer.from([0x01, dataLen, ssidBytes.length]),
      ssidBytes,
      Buffer.from([passBytes.length]),
      passBytes,
    ]);

    const cs = checksumLSB(packetNoCs);
    return Buffer.concat([packetNoCs, Buffer.from([cs])]);
  }

  const requestPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS !== "android") return true;

      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          (s) => s === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            "Permission Required",
            "Bluetooth and Location permissions are needed to scan for devices.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Settings", onPress: () => Linking.openSettings() },
            ]
          );
        }

        return allGranted;
      }

      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted = Object.values(granted).every(
        (s) => s === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        Alert.alert(
          "Permission Required",
          "Location permission is needed to scan for Bluetooth devices on this Android version.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }

      return allGranted;
    } catch (e) {
      console.error("Permission error:", e);
      return false;
    }
  };

  const openBluetoothSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("App-Prefs:Bluetooth").catch(() =>
        Linking.openSettings()
      );
      return;
    }

    if (typeof Linking.sendIntent === "function") {
      // @ts-ignore
      Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(() =>
        Linking.openSettings()
      );
    } else {
      Linking.openSettings();
    }
  };

  const normalizeDevice = (d: Device): SmartDevice => ({
    id: d.id,
    name: d.name || d.localName || "Unknown BLE Device",
    rssi: d.rssi ?? -100,
    isConnectable: d.isConnectable ?? false,
    serviceUUIDs: d.serviceUUIDs ?? [],
  });

  const canScan = (): boolean => {
    return bluetoothState === State.PoweredOn && permissionGranted;
  };

  const getScanDisabledReason = (): string | null => {
    if (bluetoothState !== State.PoweredOn) {
      switch (bluetoothState) {
        case State.PoweredOff:
          return "Bluetooth is off. Please turn on Bluetooth to scan for devices.";
        case State.Unauthorized:
          return "Bluetooth permission denied. Please grant Bluetooth permission.";
        case State.Unsupported:
          return "This device does not support Bluetooth.";
        case State.Resetting:
          return "Bluetooth is restarting. Please wait a moment.";
        default:
          return "Bluetooth is not available. Please check device settings.";
      }
    }

    if (!permissionGranted) {
      return "Required permissions not granted. Please enable Bluetooth and Location permissions.";
    }

    return null;
  };

  const scanForDevices = async () => {
    if (!canScan()) {
      const reason = getScanDisabledReason();
      if (bluetoothState !== State.PoweredOn) {
        Alert.alert("Cannot Scan", reason || "Bluetooth not available.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: openBluetoothSettings },
        ]);
      } else if (!permissionGranted) {
        await requestPermissions();
      }
      return;
    }

    setDevices(new Map());
    setScanning(true);

    bleManager.stopDeviceScan();
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

    bleManager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error("Scan error:", error);
          setScanning(false);
          Alert.alert("Scan Error", error.message);
          return;
        }
        if (!device) return;

        const item = normalizeDevice(device);
        if (!item.name.toLowerCase().startsWith("esp")) {
          return;
        }

        setDevices((prev) => {
          const next = new Map(prev);
          next.set(item.id, item);
          return next;
        });
      }
    );

    stopTimerRef.current = setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 10000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    setScanning(false);
  };

  const discoverUUIDs = async (
    device: Device
  ): Promise<DiscoveredUUIDs | null> => {
    try {
      console.log("\n===== 🔍 DISCOVERING ESPHOME IMPROV UUIDs =====");
      const services = await device.services();

      const improvService = services.find(
        (s) => s.uuid.toLowerCase() === IMPROV_SERVICE_UUID.toLowerCase()
      );

      if (!improvService) {
        console.log("❌ Improv service not found:", IMPROV_SERVICE_UUID);
        console.log(
          "Services:",
          services.map((s) => s.uuid)
        );
        return null;
      }

      const chars = await device.characteristicsForService(IMPROV_SERVICE_UUID);
      console.log(
        "Chars:",
        chars.map((c) => c.uuid)
      );

      const rpcChar = chars.find(
        (c) => c.uuid.toLowerCase() === IMPROV_RPC_CHAR_UUID.toLowerCase()
      );

      if (!rpcChar) {
        console.log("❌ Improv RPC characteristic not found.\n");
        return null;
      }

      console.log("✅ Found Improv RPC characteristic:", rpcChar.uuid);
      return {
        serviceUUID: IMPROV_SERVICE_UUID,
        characteristicUUID: IMPROV_RPC_CHAR_UUID,
      };
    } catch (e) {
      console.error("Error discovering Improv UUIDs:", e);
      return null;
    }
  };

  const connectToDevice = async (device: SmartDevice) => {
    try {
      if (scanning) {
        stopScan();
      }
      setConnecting(true);
      setConnectingDeviceName(device.name);
      const connected = await bleManager.connectToDevice(device.id, {
        timeout: 15000,
      });

      await connected.discoverAllServicesAndCharacteristics();
      const uuids = await discoverUUIDs(connected);

      if (!uuids) {
        setConnecting(false);
        Alert.alert(
          "Error",
          "Could not find writable service or characteristic.\n\nCheck console logs for details."
        );
        return;
      }

      setDiscoveredUUIDs(uuids);

      setConnecting(false);
      setConnectingDeviceName("");

      setConnectedDevice(connected);
      setShowWiFiModal(true);
    } catch (error: any) {
      console.error("Connection error:", error);
      setConnecting(false);
      setConnectingDeviceName("");

      Alert.alert(
        "Connection Failed",
        `Could not connect to ${device.name}.\n\n${
          error?.message ?? "Unknown error"
        }`
      );
    }
  };

  const sendWiFiData = async () => {
    if (!connectedDevice) {
      Alert.alert("Error", "No device connected.");
      return;
    }

    const ssid = wifiSSID.trim();
    const pass = wifiPassword;

    if (!ssid || !pass) {
      Alert.alert("Error", "Please enter both WiFi name and password");
      return;
    }

    try {
      setSettingUpWiFi(true);

      await connectedDevice.discoverAllServicesAndCharacteristics();

      const payload = buildImprovWifiPayload(ssid, pass);
      const base64Data = payload.toString("base64");

      console.log("\n📤 Improv WiFi packet hex:", payload.toString("hex"));
      console.log("📤 Writing to:", IMPROV_SERVICE_UUID, IMPROV_RPC_CHAR_UUID);

      await bleManager.writeCharacteristicWithResponseForDevice(
        connectedDevice.id,
        IMPROV_SERVICE_UUID,
        IMPROV_RPC_CHAR_UUID,
        base64Data
      );

      Alert.alert(
        "Success",
        "WiFi credentials sent via ESPHome Improv. Device will reboot and connect to WiFi in 10-30 seconds.",
        [
          {
            text: "Done",
            onPress: () => {
              setShowWiFiModal(false);
              setWifiSSID("");
              setWifiPassword("");
              setDiscoveredUUIDs(null);
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("WiFi setup error:", error);
      Alert.alert("Data Send Error", error?.message ?? "Unknown error");
    } finally {
      setSettingUpWiFi(false);
    }
  };

  const skipWiFiSetup = () => {
    Alert.alert("Skip Setup", "Are you sure you want to skip WiFi setup?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Skip",
        style: "destructive",
        onPress: () => {
          setShowWiFiModal(false);
          setWifiSSID("");
          setWifiPassword("");
          setDiscoveredUUIDs(null);
          router.back();
        },
      },
    ]);
  };

  const devicesArray = Array.from(devices.values()).sort(
    (a, b) => b.rssi - a.rssi
  );

  const scanDisabledReason = getScanDisabledReason();
  const isScanEnabled = canScan();

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-gray-50 px-5 pb-4 pt-12">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={28} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-900">Add Device</Text>
            <View className="w-7" />
          </View>
        </View>

        {/* Existing Devices Section */}
        {isConnected && (
          <View className="px-5 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xl font-bold text-gray-800">
                Connected Devices
              </Text>
              <TouchableOpacity onPress={loadExistingDevices}>
                <Ionicons name="refresh" size={20} color="#9333EA" />
              </TouchableOpacity>
            </View>

            {loadingExisting ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" color="#9333EA" />
                <Text className="text-gray-500 mt-2">Loading devices...</Text>
              </View>
            ) : existingDevices.length > 0 ? (
              <View className="gap-3">
                {existingDevices.map((device) => (
                  <View
                    key={device.entity_id}
                    className="rounded-[24px] bg-white p-4 shadow-sm"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                        <Ionicons
                          name="hardware-chip"
                          size={24}
                          color="#9333EA"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900">
                          {device.name}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          Available for reset
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => factoryResetDevice(device)}
                        className="rounded-xl bg-red-50 px-4 py-2"
                      >
                        <Text className="text-sm font-semibold text-red-600">
                          Disconnect
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center justify-center rounded-[24px] bg-white p-8 shadow-sm">
                <Ionicons
                  name="hardware-chip-outline"
                  size={48}
                  color="#D1D5DB"
                />
                <Text className="mt-3 text-center text-sm text-gray-500">
                  No connected ESP devices found
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Divider */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-px bg-gray-300" />
            <Text className="text-sm font-semibold text-gray-500">
              OR ADD NEW DEVICE
            </Text>
            <View className="flex-1 h-px bg-gray-300" />
          </View>
        </View>

        {/* Scan Section */}
        <View className="px-5">
          <Text className="text-xl font-bold text-gray-800 mb-3">
            Scan for New Devices
          </Text>

          {scanning ? (
            <TouchableOpacity
              className="p-4 bg-gray-400 rounded-xl items-center mb-4"
              onPress={stopScan}
            >
              <View className="flex-row items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white text-base font-semibold ml-2">
                  Scanning... Tap to Stop
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                className={`p-4 rounded-xl items-center mb-4 ${
                  isScanEnabled ? "bg-blue-500" : "bg-gray-300"
                }`}
                onPress={scanForDevices}
                disabled={!isScanEnabled}
              >
                <Text
                  className={`text-base font-semibold ${
                    isScanEnabled ? "text-white" : "text-gray-500"
                  }`}
                >
                  Scan for Devices
                </Text>
              </TouchableOpacity>

              {scanDisabledReason && (
                <View className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Text className="text-sm text-amber-800 text-center">
                    {scanDisabledReason}
                  </Text>
                  <TouchableOpacity
                    className="mt-2 p-2 bg-amber-600 rounded-lg"
                    onPress={openBluetoothSettings}
                  >
                    <Text className="text-white text-center text-sm font-semibold">
                      Open Settings
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {devicesArray.length > 0 && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-gray-900">
                  Found ({devicesArray.length})
                </Text>
                {!scanning && isScanEnabled && (
                  <TouchableOpacity onPress={scanForDevices}>
                    <Text className="text-sm text-blue-600 font-semibold">
                      Refresh
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {devicesArray.map((device) => (
                <TouchableOpacity
                  key={device.id}
                  className="p-4 mb-3 bg-white rounded-[24px] border border-gray-200 shadow-sm active:bg-gray-50"
                  onPress={() => connectToDevice(device)}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Ionicons name="bluetooth" size={20} color="#3B82F6" />
                        <Text className="ml-2 text-lg font-semibold text-gray-900">
                          {device.name}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9CA3AF"
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!scanning && devicesArray.length === 0 && (
            <View className="mt-8 items-center pb-10">
              <Ionicons name="search-outline" size={64} color="#D1D5DB" />
              <Text className="text-lg font-semibold text-gray-900 mt-3">
                No Devices Found
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                Make sure your device is in pairing mode
              </Text>
            </View>
          )}

          {scanning && devicesArray.length === 0 && (
            <View className="mt-8 items-center pb-10">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="text-lg font-semibold text-gray-900 mt-4">
                Searching for Devices...
              </Text>
            </View>
          )}
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Connection Loading Overlay */}
      {connecting && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center z-10">
          <View className="bg-white rounded-2xl p-6 items-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-lg font-semibold text-gray-900 mt-4">
              Connecting...
            </Text>
            <Text className="text-sm text-gray-600 mt-2">
              {connectingDeviceName}
            </Text>
          </View>
        </View>
      )}

      {/* WiFi Setup Modal - IMPROVED FOR ANDROID KEYBOARD */}
      <Modal
        visible={showWiFiModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!settingUpWiFi) {
            skipWiFiSetup();
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-black/50 justify-center items-center px-5">
              <TouchableWithoutFeedback>
                <View
                  className="bg-white rounded-3xl w-full"
                  style={{
                    maxHeight: "80%",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 10,
                  }}
                >
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    contentContainerStyle={{ padding: 24 }}
                  >
                    {/* Handle */}
                    <View className="items-center mb-6">
                      <View className="w-12 h-1 bg-gray-300 rounded-full mb-4" />
                      <Text className="text-2xl font-bold text-gray-900">
                        WiFi Setup
                      </Text>
                      <Text className="text-sm text-gray-600 mt-2 text-center">
                        Enter WiFi credentials to connect the device
                      </Text>
                    </View>

                    {/* WiFi SSID Input */}
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        WiFi Name (SSID)
                      </Text>
                      <TextInput
                        className="border border-gray-300 rounded-lg p-4 text-base bg-white"
                        placeholder="Enter WiFi name..."
                        value={wifiSSID}
                        onChangeText={setWifiSSID}
                        autoCapitalize="none"
                        editable={!settingUpWiFi}
                        returnKeyType="next"
                        onSubmitEditing={() => {
                          // Focus password input (you can add ref if needed)
                        }}
                      />
                    </View>

                    {/* WiFi Password Input */}
                    <View className="mb-6">
                      <Text className="text-sm font-semibold text-gray-700 mb-2">
                        WiFi Password
                      </Text>
                      <TextInput
                        className="border border-gray-300 rounded-lg p-4 text-base bg-white"
                        placeholder="Enter WiFi password..."
                        value={wifiPassword}
                        onChangeText={setWifiPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        editable={!settingUpWiFi}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          Keyboard.dismiss();
                          if (wifiSSID.trim() && wifiPassword) {
                            sendWiFiData();
                          }
                        }}
                      />
                    </View>

                    {/* Action Buttons */}
                    <View className="gap-y-3">
                      <TouchableOpacity
                        className={`p-4 rounded-lg ${
                          settingUpWiFi ? "bg-blue-300" : "bg-blue-500"
                        }`}
                        onPress={sendWiFiData}
                        disabled={settingUpWiFi}
                      >
                        {settingUpWiFi ? (
                          <View className="flex-row items-center justify-center">
                            <ActivityIndicator color="white" size="small" />
                            <Text className="text-white text-center font-semibold ml-2">
                              Sending...
                            </Text>
                          </View>
                        ) : (
                          <Text className="text-white text-center text-base font-semibold">
                            Send WiFi Credentials
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="p-4 rounded-lg border border-gray-300"
                        onPress={skipWiFiSetup}
                        disabled={settingUpWiFi}
                      >
                        <Text className="text-gray-700 text-center text-base font-semibold">
                          Skip
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
