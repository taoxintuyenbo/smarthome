import AsyncStorage from "@react-native-async-storage/async-storage";

// Default configuration
const DEFAULT_HA_IP = "ha.namtrung.net:8123";
const DEFAULT_HA_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYjFiNTg4MzZmZTE0OWRhODcxZjQxMDJhYWYwNzI3NCIsImlhdCI6MTc2NjU3MzE0NywiZXhwIjoyMDgxOTMzMTQ3fQ.UU3bRlrQp5CmSt7aOL02fUlay5YxTiyevdE5Nvj9_Ko";

const HOMES_KEY = "@homes_data";
const HA_CONFIG_KEY = "@ha_config";

export interface Room {
  id: string;
  name: string;
  icon: string;
}

export interface Home {
  id: string;
  name: string;
  address: string;
  haIp?: string;
  haToken?: string;
  rooms: Room[];
  devices: number;
  isActive: boolean;
  createdAt: string;
}

export interface HAConfig {
  ip: string;
  token: string;
}

export const HomeStorage = {
  async getAllHomes(): Promise<Home[]> {
    try {
      const data = await AsyncStorage.getItem(HOMES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting homes:", error);
      return [];
    }
  },

  async saveHome(home: Home): Promise<void> {
    try {
      const homes = await this.getAllHomes();
      homes.push(home);
      await AsyncStorage.setItem(HOMES_KEY, JSON.stringify(homes));
    } catch (error) {
      console.error("Error saving home:", error);
    }
  },

  async updateHome(homeId: string, updates: Partial<Home>): Promise<void> {
    try {
      const homes = await this.getAllHomes();
      const index = homes.findIndex((h) => h.id === homeId);
      if (index !== -1) {
        homes[index] = { ...homes[index], ...updates };
        await AsyncStorage.setItem(HOMES_KEY, JSON.stringify(homes));
      }
    } catch (error) {
      console.error("Error updating home:", error);
    }
  },

  async setActiveHome(homeId: string): Promise<void> {
    try {
      const homes = await this.getAllHomes();
      const updatedHomes = homes.map((home) => ({
        ...home,
        isActive: home.id === homeId,
      }));
      await AsyncStorage.setItem(HOMES_KEY, JSON.stringify(updatedHomes));
    } catch (error) {
      console.error("Error setting active home:", error);
    }
  },

  async deleteHome(homeId: string): Promise<void> {
    try {
      const homes = await this.getAllHomes();
      const filteredHomes = homes.filter((h) => h.id !== homeId);
      await AsyncStorage.setItem(HOMES_KEY, JSON.stringify(filteredHomes));
    } catch (error) {
      console.error("Error deleting home:", error);
    }
  },

  async getActiveHome(): Promise<Home | null> {
    try {
      const homes = await this.getAllHomes();
      return homes.find((h) => h.isActive) || null;
    } catch (error) {
      console.error("Error getting active home:", error);
      return null;
    }
  },

  // Update device count for a home
  async updateDeviceCount(homeId: string, count: number): Promise<void> {
    try {
      await this.updateHome(homeId, { devices: count });
    } catch (error) {
      console.error("Error updating device count:", error);
    }
  },

  // HA Configuration methods
  async saveHAConfig(config: HAConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(HA_CONFIG_KEY, JSON.stringify(config));
      console.log("✅ HA Config saved successfully");
    } catch (error) {
      console.error("Error saving HA config:", error);
      throw error;
    }
  },

  async getHAConfig(): Promise<HAConfig> {
    try {
      const data = await AsyncStorage.getItem(HA_CONFIG_KEY);
      if (data) {
        const config = JSON.parse(data);
        // Return stored config if it has values
        if (config.ip && config.token) {
          return config;
        }
      }
      // Return default configuration
      return {
        ip: DEFAULT_HA_IP,
        token: DEFAULT_HA_TOKEN,
      };
    } catch (error) {
      console.error("Error getting HA config:", error);
      // Return default on error
      return {
        ip: DEFAULT_HA_IP,
        token: DEFAULT_HA_TOKEN,
      };
    }
  },

  async hasStoredConfig(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(HA_CONFIG_KEY);
      return data !== null;
    } catch (error) {
      console.error("Error checking HA config:", error);
      return false;
    }
  },

  async deleteHAConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HA_CONFIG_KEY);
      console.log("✅ HA Config deleted");
    } catch (error) {
      console.error("Error deleting HA config:", error);
    }
  },
};
