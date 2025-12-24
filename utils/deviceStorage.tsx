import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_NAMES_KEY = "@device_custom_names";
const DEVICE_ROOMS_KEY = "@device_room_assignments";

export interface DeviceCustomName {
  entity_id: string;
  customName: string;
}

export interface DeviceRoomAssignment {
  entity_id: string;
  roomId: string;
  homeId: string;
  assignedAt: string;
}

export const DeviceStorage = {
  // Custom names methods
  async getCustomNames(): Promise<Record<string, string>> {
    try {
      const data = await AsyncStorage.getItem(DEVICE_NAMES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Error getting custom names:", error);
      return {};
    }
  },

  async saveCustomName(entity_id: string, customName: string): Promise<void> {
    try {
      const customNames = await this.getCustomNames();
      customNames[entity_id] = customName;
      await AsyncStorage.setItem(DEVICE_NAMES_KEY, JSON.stringify(customNames));
    } catch (error) {
      console.error("Error saving custom name:", error);
    }
  },

  async getCustomName(entity_id: string): Promise<string | null> {
    try {
      const customNames = await this.getCustomNames();
      return customNames[entity_id] || null;
    } catch (error) {
      console.error("Error getting custom name:", error);
      return null;
    }
  },

  async deleteCustomName(entity_id: string): Promise<void> {
    try {
      const customNames = await this.getCustomNames();
      delete customNames[entity_id];
      await AsyncStorage.setItem(DEVICE_NAMES_KEY, JSON.stringify(customNames));
    } catch (error) {
      console.error("Error deleting custom name:", error);
    }
  },

  // Room assignment methods
  async getRoomAssignments(): Promise<Record<string, DeviceRoomAssignment>> {
    try {
      const data = await AsyncStorage.getItem(DEVICE_ROOMS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Error getting room assignments:", error);
      return {};
    }
  },

  async assignDeviceToRoom(
    entity_id: string,
    roomId: string,
    homeId: string
  ): Promise<void> {
    try {
      const assignments = await this.getRoomAssignments();
      assignments[entity_id] = {
        entity_id,
        roomId,
        homeId,
        assignedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(DEVICE_ROOMS_KEY, JSON.stringify(assignments));
    } catch (error) {
      console.error("Error assigning device to room:", error);
      throw error;
    }
  },

  async getDeviceRoomAssignment(
    entity_id: string
  ): Promise<DeviceRoomAssignment | null> {
    try {
      const assignments = await this.getRoomAssignments();
      return assignments[entity_id] || null;
    } catch (error) {
      console.error("Error getting device room assignment:", error);
      return null;
    }
  },

  async getDevicesByRoom(roomId: string, homeId: string): Promise<string[]> {
    try {
      const assignments = await this.getRoomAssignments();
      return Object.values(assignments)
        .filter((a) => a.roomId === roomId && a.homeId === homeId)
        .map((a) => a.entity_id);
    } catch (error) {
      console.error("Error getting devices by room:", error);
      return [];
    }
  },

  async getDevicesByHome(homeId: string): Promise<string[]> {
    try {
      const assignments = await this.getRoomAssignments();
      return Object.values(assignments)
        .filter((a) => a.homeId === homeId)
        .map((a) => a.entity_id);
    } catch (error) {
      console.error("Error getting devices by home:", error);
      return [];
    }
  },

  async removeDeviceFromRoom(entity_id: string): Promise<void> {
    try {
      const assignments = await this.getRoomAssignments();
      delete assignments[entity_id];
      await AsyncStorage.setItem(DEVICE_ROOMS_KEY, JSON.stringify(assignments));
    } catch (error) {
      console.error("Error removing device from room:", error);
      throw error;
    }
  },

  async getUnassignedDevices(
    allEntityIds: string[],
    homeId: string
  ): Promise<string[]> {
    try {
      const assignments = await this.getRoomAssignments();
      const assignedInHome = Object.values(assignments)
        .filter((a) => a.homeId === homeId)
        .map((a) => a.entity_id);

      return allEntityIds.filter((id) => !assignedInHome.includes(id));
    } catch (error) {
      console.error("Error getting unassigned devices:", error);
      return allEntityIds;
    }
  },

  // Get devices assigned to other rooms in the same home
  async getDevicesInOtherRooms(
    currentRoomId: string,
    homeId: string
  ): Promise<string[]> {
    try {
      const assignments = await this.getRoomAssignments();
      return Object.values(assignments)
        .filter((a) => a.homeId === homeId && a.roomId !== currentRoomId)
        .map((a) => a.entity_id);
    } catch (error) {
      console.error("Error getting devices in other rooms:", error);
      return [];
    }
  },
};
