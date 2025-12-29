import { HomeStorage } from "@/utils/homeStorage";

let HA_CONFIG = {
  URL: "wss://ha.namtrung.net:8123/api/websocket",
  TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYjFiNTg4MzZmZTE0OWRhODcxZjQxMDJhYWYwNzI3NCIsImlhdCI6MTc2NjU3MzE0NywiZXhwIjoyMDgxOTMzMTQ3fQ.UU3bRlrQp5CmSt7aOL02fUlay5YxTiyevdE5Nvj9_Ko",
};

(async () => {
  const config = await HomeStorage.getHAConfig();
  HA_CONFIG = {
    URL: `wss://${config.ip}/api/websocket`,
    TOKEN: config.token,
  };
})();

export { HA_CONFIG };

const DEFAULT_HA_CONFIG = {
  URL: "wss://ha.namtrung.net:8123/api/websocket",
  TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYjFiNTg4MzZmZTE0OWRhODcxZjQxMDJhYWYwNzI3NCIsImlhdCI6MTc2NjU3MzE0NywiZXhwIjoyMDgxOTMzMTQ3fQ.UU3bRlrQp5CmSt7aOL02fUlay5YxTiyevdE5Nvj9_Ko",
} as const;

export class HomeAssistantWebSocket {
  private ws: WebSocket | null = null;
  private messageId = 1;
  private config: { url: string; token: string } | null = null;

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<{ url: string; token: string }> {
    try {
      // First, try to get global HA config
      const haConfig = await HomeStorage.getHAConfig();

      if (haConfig.ip && haConfig.token) {
        // Use global HA configuration
        const url =
          haConfig.ip.startsWith("ws://") || haConfig.ip.startsWith("wss://")
            ? `${haConfig.ip}/api/websocket`
            : `wss://${haConfig.ip}/api/websocket`;

        const config = {
          url,
          token: haConfig.token,
        };

        console.log("🏠 Using global HA configuration:", url);
        return config;
      } else {
        // Fallback:  Check if active home has specific configuration
        const activeHome = await HomeStorage.getActiveHome();

        if (activeHome?.haIp && activeHome?.haToken) {
          const url =
            activeHome.haIp.startsWith("ws://") ||
            activeHome.haIp.startsWith("wss://")
              ? `${activeHome.haIp}/api/websocket`
              : `wss://${activeHome.haIp}/api/websocket`;

          const config = {
            url,
            token: activeHome.haToken,
          };

          console.log("🏠 Using home-specific HA configuration:", url);
          return config;
        } else {
          // Use default configuration
          const config = {
            url: DEFAULT_HA_CONFIG.URL,
            token: DEFAULT_HA_CONFIG.TOKEN,
          };

          console.log("🏠 Using default HA configuration");
          return config;
        }
      }
    } catch (error) {
      console.error("Error loading HA config:", error);
      // Fallback to default
      return {
        url: DEFAULT_HA_CONFIG.URL,
        token: DEFAULT_HA_CONFIG.TOKEN,
      };
    }
  }

  async connect(): Promise<WebSocket> {
    // Load configuration before connecting
    const config = await this.loadConfig();
    this.config = config;

    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(config.url);

      this.ws.onopen = () => {
        console.log("✅ HA WebSocket connected");
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "auth_required") {
          this.ws?.send(
            JSON.stringify({
              type: "auth",
              access_token: config.token,
            })
          );
        } else if (message.type === "auth_ok") {
          console.log("✅ HA Authentication successful");
          resolve(this.ws!);
        } else if (message.type === "auth_invalid") {
          console.error("❌ HA Authentication failed");
          reject(new Error("Authentication failed"));
        }
      };

      this.ws.onerror = (error) => {
        console.error("❌ HA WebSocket error:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log("🔌 HA WebSocket disconnected");
      };
    });
  }

  async getStates(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = this.messageId++;
      const messageHandler = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

        if (message.id === id && message.type === "result") {
          if (message.success) {
            resolve(message.result);
          } else {
            reject(new Error(message.error?.message || "Failed to get states"));
          }
          this.ws?.removeEventListener("message", messageHandler);
        }
      };

      this.ws.addEventListener("message", messageHandler);

      this.ws.send(
        JSON.stringify({
          id,
          type: "get_states",
        })
      );
    });
  }

  /**
   * Call a Home Assistant service
   */
  async callService(
    domain: string,
    service: string,
    serviceData?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = this.messageId++;
      const messageHandler = (event: MessageEvent) => {
        const message = JSON.parse(event.data);

        if (message.id === id && message.type === "result") {
          if (message.success) {
            resolve(message.result);
          } else {
            reject(
              new Error(message.error?.message || "Failed to call service")
            );
          }
          this.ws?.removeEventListener("message", messageHandler);
        }
      };

      this.ws.addEventListener("message", messageHandler);

      this.ws.send(
        JSON.stringify({
          id,
          type: "call_service",
          domain,
          service,
          service_data: serviceData,
        })
      );
    });
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): { url: string; token: string } | null {
    return this.config;
  }

  /**
   * Reconnect with fresh configuration from storage
   */
  async reconnect(): Promise<WebSocket> {
    console.log("🔄 Reconnecting with fresh configuration");
    this.close();
    return this.connect();
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.config = null;
  }
}
