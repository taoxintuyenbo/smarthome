import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ScenarioDevice {
  entity_id: string;
  name: string;
  action: "turn_on" | "turn_off";
  brightness?: number;
}

export interface Scenario {
  id: string;
  name: string;
  scene_id: string;
  devices: ScenarioDevice[];
  created_at: string;
  automation_id?: string;
  trigger_time?: string;
  trigger_days?: string[];
  enabled?: boolean;
}

export class AutomationStorage {
  private static SCENARIOS_KEY = "scenarios";

  /**
   * Sanitize entity ID - remove spaces and invalid characters
   */
  private static sanitizeEntityId(entityId: string): string {
    return entityId
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_. ]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  static async saveScenario(scenario: Scenario): Promise<void> {
    try {
      const scenarios = await this.getScenarios();
      scenarios.push(scenario);
      await AsyncStorage.setItem(this.SCENARIOS_KEY, JSON.stringify(scenarios));
      console.log("✅ Scenario saved:", scenario.name);
    } catch (error) {
      console.error("❌ Error saving scenario:", error);
      throw error;
    }
  }

  static async getScenarios(): Promise<Scenario[]> {
    try {
      const data = await AsyncStorage.getItem(this.SCENARIOS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("❌ Error getting scenarios:", error);
      return [];
    }
  }

  static async getScenario(scenarioId: string): Promise<Scenario | null> {
    try {
      const scenarios = await this.getScenarios();
      return scenarios.find((s) => s.id === scenarioId) || null;
    } catch (error) {
      console.error("❌ Error getting scenario:", error);
      return null;
    }
  }

  static async updateScenario(
    scenarioId: string,
    updates: Partial<Scenario>
  ): Promise<void> {
    try {
      const scenarios = await this.getScenarios();
      const index = scenarios.findIndex((s) => s.id === scenarioId);

      if (index !== -1) {
        scenarios[index] = { ...scenarios[index], ...updates };
        await AsyncStorage.setItem(
          this.SCENARIOS_KEY,
          JSON.stringify(scenarios)
        );
        console.log("✅ Scenario updated:", scenarioId);
      } else {
        throw new Error("Scenario not found");
      }
    } catch (error) {
      console.error("❌ Error updating scenario:", error);
      throw error;
    }
  }

  static async deleteScenario(scenarioId: string): Promise<void> {
    try {
      const scenarios = await this.getScenarios();
      const filtered = scenarios.filter((s) => s.id !== scenarioId);
      await AsyncStorage.setItem(this.SCENARIOS_KEY, JSON.stringify(filtered));
      console.log("✅ Scenario deleted:", scenarioId);
    } catch (error) {
      console.error("❌ Error deleting scenario:", error);
      throw error;
    }
  }

  /**
   * Activate a scenario by directly controlling devices
   * This approach works WITHOUT needing HA scenes
   */
  static async activateScenario(
    scenario: Scenario,
    ws: WebSocket
  ): Promise<void> {
    try {
      console.log("🎬 Activating scenario:", scenario.name);
      console.log("   - Devices:", scenario.devices.length);

      // Directly control each device
      scenario.devices.forEach((device, index) => {
        const domain = device.entity_id.split(".")[0];
        const service = device.action; // "turn_on" or "turn_off"

        setTimeout(() => {
          ws.send(
            JSON.stringify({
              id: Date.now() + index,
              type: "call_service",
              domain: domain,
              service: service,
              target: {
                entity_id: device.entity_id,
              },
            })
          );
          console.log(`   ✅ ${device.name}:  ${service}`);
        }, index * 100); // Stagger requests by 100ms
      });

      console.log("✅ Scenario activation commands sent");
    } catch (error) {
      console.error("❌ Error activating scenario:", error);
      throw error;
    }
  }

  /**
   * Alternative:  Activate by scene ID (if scene exists in HA)
   */
  static async activateScenarioBySceneId(
    sceneId: string,
    ws: WebSocket
  ): Promise<void> {
    try {
      const cleanSceneId = sceneId.includes(".")
        ? `${sceneId.split(".")[0]}.${this.sanitizeEntityId(sceneId.split(".")[1])}`
        : sceneId;

      console.log("🎬 Activating scene:", cleanSceneId);

      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "call_service",
          domain: "scene",
          service: "turn_on",
          target: {
            entity_id: cleanSceneId,
          },
        })
      );
    } catch (error) {
      console.error("❌ Error activating scenario:", error);
      throw error;
    }
  }

  /**
   * Create scene in Home Assistant (temporary - in memory only)
   */
  static async createSceneInHA(
    ws: WebSocket,
    sceneName: string,
    entities: Record<string, string>
  ): Promise<string> {
    try {
      const sanitizedName = this.sanitizeEntityId(sceneName);
      const sceneId = `scene.${sanitizedName}`;

      console.log("🎨 Creating temporary scene:");
      console.log("   - Scene ID:", sceneId);
      console.log("   - Entities:", Object.keys(entities).length);

      // Convert action strings to proper state format
      const entityStates: Record<string, any> = {};
      Object.entries(entities).forEach(([entityId, action]) => {
        entityStates[entityId] = {
          state: action === "turn_on" ? "on" : "off",
        };
      });

      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "call_service",
          domain: "scene",
          service: "create",
          service_data: {
            scene_id: sceneId,
            entities: entityStates,
          },
        })
      );

      console.log("⚠️  Note: Scene is temporary (memory only)");
      console.log("   It will disappear after HA restart");

      return sceneId;
    } catch (error) {
      console.error("❌ Error creating scene in HA:", error);
      throw error;
    }
  }

  /**
   * Create persistent scene using config/scene/config API
   */
  static async createPersistentSceneInHA(
    ws: WebSocket,
    sceneName: string,
    entities: Record<string, string>
  ): Promise<string> {
    try {
      const sanitizedName = this.sanitizeEntityId(sceneName);
      const sceneId = `scene.${sanitizedName}`;

      console.log("💾 Creating persistent scene:");
      console.log("   - Scene ID:", sceneId);

      // Build scene entities
      const sceneEntities: Record<string, any> = {};
      Object.entries(entities).forEach(([entityId, action]) => {
        sceneEntities[entityId] = {
          state: action === "turn_on" ? "on" : "off",
        };
      });

      // Try to create scene using config API (requires write permissions)
      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "config/scene/config/create",
          config: {
            name: sceneName,
            entities: sceneEntities,
          },
        })
      );

      console.log("✅ Persistent scene creation requested");
      return sceneId;
    } catch (error) {
      console.error("❌ Error creating persistent scene:", error);
      throw error;
    }
  }

  /**
   * Create time-based automation in Home Assistant
   * Uses Script approach (more reliable than automation config)
   */
  static async createTimeAutomationWithDays(
    ws: WebSocket,
    scenarioName: string,
    sceneId: string,
    triggerTime: string,
    days: string[]
  ): Promise<string> {
    try {
      const sanitizedName = this.sanitizeEntityId(scenarioName);
      const automationId = `automation.${sanitizedName}_timer`;

      console.log("⏰ Creating automation:");
      console.log("   - Automation ID:", automationId);
      console.log("   - Time:", triggerTime);
      console.log(
        "   - Days:",
        days.length === 7 ? "Every day" : days.join(", ")
      );

      const automationConfig: any = {
        alias: `${scenarioName} - Timer`,
        description: `Auto-created:  ${scenarioName}`,
        trigger: [
          {
            platform: "time",
            at: triggerTime,
          },
        ],
        action: [
          {
            service: "scene. turn_on",
            target: {
              entity_id: sceneId,
            },
          },
        ],
        mode: "single",
      };

      if (days.length > 0 && days.length < 7) {
        automationConfig.condition = [
          {
            condition: "time",
            weekday: days,
          },
        ];
      }

      // Attempt to create via config API
      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "config/automation/config/create",
          config: automationConfig,
        })
      );

      console.log(
        "⚠️  Note: Automation creation may require HA configuration access"
      );
      console.log("   Manual setup may be needed in HA UI");

      return automationId;
    } catch (error) {
      console.error("❌ Error creating automation:", error);
      throw error;
    }
  }

  static async toggleAutomation(
    automationId: string,
    enabled: boolean,
    ws: WebSocket
  ): Promise<void> {
    try {
      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "call_service",
          domain: "automation",
          service: enabled ? "turn_on" : "turn_off",
          target: {
            entity_id: automationId,
          },
        })
      );
      console.log(
        `✅ Automation ${enabled ? "enabled" : "disabled"}: `,
        automationId
      );
    } catch (error) {
      console.error("❌ Error toggling automation:", error);
      throw error;
    }
  }

  static async deleteAutomationFromHA(
    ws: WebSocket,
    automationId: string
  ): Promise<void> {
    try {
      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "call_service",
          domain: "automation",
          service: "turn_off",
          target: {
            entity_id: automationId,
          },
        })
      );
      console.log("✅ Automation turned off:", automationId);
    } catch (error) {
      console.error("❌ Error deleting automation:", error);
      throw error;
    }
  }

  static async deleteSceneFromHA(
    ws: WebSocket,
    sceneId: string
  ): Promise<void> {
    try {
      ws.send(
        JSON.stringify({
          id: Date.now(),
          type: "call_service",
          domain: "scene",
          service: "delete",
          target: {
            entity_id: sceneId,
          },
        })
      );
      console.log("✅ Scene delete requested:", sceneId);
    } catch (error) {
      console.error("❌ Error deleting scene:", error);
      throw error;
    }
  }

  static async clearAllScenarios(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SCENARIOS_KEY);
      console.log("✅ All scenarios cleared");
    } catch (error) {
      console.error("❌ Error clearing scenarios:", error);
      throw error;
    }
  }

  static async getScenariosCount(): Promise<number> {
    try {
      const scenarios = await this.getScenarios();
      return scenarios.length;
    } catch (error) {
      console.error("❌ Error getting scenarios count:", error);
      return 0;
    }
  }
}
