import { HomeStorage } from "@/utils/homeStorage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

let HA_CONFIG = {
  URL: "ws://ha.namtrung.net:8123/api/websocket",
  TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYjFiNTg4MzZmZTE0OWRhODcxZjQxMDJhYWYwNzI3NCIsImlhdCI6MTc2NjU3MzE0NywiZXhwIjoyMDgxOTMzMTQ3fQ.UU3bRlrQp5CmSt7aOL02fUlay5YxTiyevdE5Nvj9_Ko",
};

(async () => {
  const config = await HomeStorage.getHAConfig();
  HA_CONFIG = {
    URL: `ws://${config.ip}/api/websocket`,
    TOKEN: config.token,
  };
})();

export { HA_CONFIG };

const DEFAULT_HA_CONFIG = {
  URL: "ws://ha.namtrung.net:8123/api/websocket",
  TOKEN:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkYjFiNTg4MzZmZTE0OWRhODcxZjQxMDJhYWYwNzI3NCIsImlhdCI6MTc2NjU3MzE0NywiZXhwIjoyMDgxOTMzMTQ3fQ.UU3bRlrQp5CmSt7aOL02fUlay5YxTiyevdE5Nvj9_Ko",
} as const;

interface WebSocketMessage {
  id?: number;
  type: string;
  [key: string]: any;
}

interface HomeAssistantContextType {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  sendMessage: (message: Omit<WebSocketMessage, "id">) => Promise<any>;
  subscribeToEvents: (
    eventType: string,
    callback: (event: any) => void
  ) => () => void;
  getStates: () => Promise<any[]>;
  callService: (
    domain: string,
    service: string,
    serviceData?: any
  ) => Promise<any>;
  currentConfig: { url: string; token: string };
}

const HomeAssistantContext = createContext<
  HomeAssistantContextType | undefined
>(undefined);

export const useHomeAssistant = () => {
  const context = useContext(HomeAssistantContext);
  if (!context) {
    throw new Error(
      "useHomeAssistant must be used within a HomeAssistantProvider"
    );
  }
  return context;
};

interface HomeAssistantProviderProps {
  children: ReactNode;
}

export const HomeAssistantProvider: React.FC<HomeAssistantProviderProps> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<{
    url: string;
    token: string;
  }>({
    url: DEFAULT_HA_CONFIG.URL,
    token: DEFAULT_HA_CONFIG.TOKEN,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const messageIdRef = useRef(1);
  const pendingMessagesRef = useRef<
    Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>
  >(new Map());
  const eventSubscriptionsRef = useRef<Map<number, (event: any) => void>>(
    new Map()
  );
  const activeSubscriptionsRef = useRef<Set<number>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const appStateRef = useRef(AppState.currentState);
  const shouldReconnect = useRef(true);

  // Load configuration from storage
  const loadConfig = useCallback(async () => {
    try {
      // First, try to get global HA config
      const haConfig = await HomeStorage.getHAConfig();

      if (haConfig.ip && haConfig.token) {
        // Use global HA configuration
        const url =
          haConfig.ip.startsWith("ws://") || haConfig.ip.startsWith("wss://")
            ? `${haConfig.ip}/api/websocket`
            : `ws://${haConfig.ip}/api/websocket`;

        const newConfig = {
          url,
          token: haConfig.token,
        };

        setCurrentConfig(newConfig);
        console.log("🏠 Using global HA configuration:", url);
        return newConfig;
      } else {
        // Fallback: Check if active home has specific configuration
        const activeHome = await HomeStorage.getActiveHome();

        if (activeHome?.haIp && activeHome?.haToken) {
          const url =
            activeHome.haIp.startsWith("ws://") ||
            activeHome.haIp.startsWith("wss://")
              ? `${activeHome.haIp}/api/websocket`
              : `ws://${activeHome.haIp}/api/websocket`;

          const newConfig = {
            url,
            token: activeHome.haToken,
          };

          setCurrentConfig(newConfig);
          console.log("🏠 Using home-specific HA configuration:", url);
          return newConfig;
        } else {
          // Use default configuration
          const newConfig = {
            url: DEFAULT_HA_CONFIG.URL,
            token: DEFAULT_HA_CONFIG.TOKEN,
          };

          setCurrentConfig(newConfig);
          console.log("🏠 Using default HA configuration");
          return newConfig;
        }
      }
    } catch (error) {
      console.error("Error loading HA config:", error);
      // Fallback to default
      const newConfig = {
        url: DEFAULT_HA_CONFIG.URL,
        token: DEFAULT_HA_CONFIG.TOKEN,
      };
      setCurrentConfig(newConfig);
      return newConfig;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;

      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }

      wsRef.current = null;
    }

    pendingMessagesRef.current.forEach(({ reject }) => {
      reject(new Error("Connection closed"));
    });
    pendingMessagesRef.current.clear();
    eventSubscriptionsRef.current.clear();
    activeSubscriptionsRef.current.clear();
  }, []);

  const connect = useCallback(async () => {
    // Load configuration before connecting
    const config = await loadConfig();

    cleanup();
    setIsConnecting(true);
    setError(null);

    return new Promise<void>((resolve, reject) => {
      try {
        console.log("🔌 Connecting to Home Assistant:", config.url);

        const ws = new WebSocket(config.url);
        wsRef.current = ws;

        const authTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        ws.onopen = () => {
          console.log("✅ WebSocket connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === "auth_required") {
              console.log("🔐 Authentication required");
              ws.send(
                JSON.stringify({
                  type: "auth",
                  access_token: config.token,
                })
              );
            } else if (message.type === "auth_ok") {
              console.log("✅ Authentication successful");
              clearTimeout(authTimeout);
              setIsConnected(true);
              setIsConnecting(false);
              setError(null);
              reconnectAttemptsRef.current = 0;
              resolve();
            } else if (message.type === "auth_invalid") {
              console.error("❌ Authentication failed");
              clearTimeout(authTimeout);
              setError("Authentication failed. Check your access token.");
              setIsConnecting(false);
              ws.close();
              reject(new Error("Authentication failed"));
            } else if (message.type === "result") {
              const pending = pendingMessagesRef.current.get(message.id);
              if (pending) {
                if (message.success) {
                  if (
                    message.result &&
                    message.result.subscription !== undefined
                  ) {
                    activeSubscriptionsRef.current.add(message.id);
                  }
                  pending.resolve(message.result);
                } else {
                  pending.reject(
                    new Error(message.error?.message || "Unknown error")
                  );
                }
                pendingMessagesRef.current.delete(message.id);
              }
            } else if (message.type === "event") {
              const callback = eventSubscriptionsRef.current.get(message.id);
              if (callback) {
                callback(message.event);
              }
            }
          } catch (err) {
            console.error("Error parsing message:", err);
          }
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          clearTimeout(authTimeout);
          setError("Connection error");
          setIsConnecting(false);
          reject(error);
        };

        ws.onclose = (event) => {
          console.log("🔌 WebSocket closed:", event.code, event.reason);
          setIsConnected(false);
          setIsConnecting(false);

          // Auto-reconnect logic
          if (
            shouldReconnect.current &&
            reconnectAttemptsRef.current < maxReconnectAttempts &&
            appStateRef.current === "active"
          ) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current),
              30000
            );
            console.log(
              `🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        };
      } catch (err) {
        console.error("Connection error:", err);
        setError("Failed to connect");
        setIsConnecting(false);
        reject(err);
      }
    });
  }, [cleanup, loadConfig]);

  const disconnect = useCallback(() => {
    console.log("🔌 Disconnecting from Home Assistant");
    shouldReconnect.current = false;
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent reconnect
    cleanup();
    setIsConnected(false);
    setError(null);
  }, [cleanup]);

  const reconnect = useCallback(async () => {
    console.log("🔄 Manual reconnect triggered");
    shouldReconnect.current = true;
    reconnectAttemptsRef.current = 0;
    await disconnect();
    // Small delay to ensure cleanup is complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await connect();
  }, [disconnect, connect]);

  const sendMessage = useCallback(
    (message: Omit<WebSocketMessage, "id">): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket is not connected"));
          return;
        }

        const id = messageIdRef.current++;
        const fullMessage = { ...message, id };

        pendingMessagesRef.current.set(id, { resolve, reject });

        try {
          wsRef.current.send(JSON.stringify(fullMessage));
          console.log("📤 Sent:", message.type);
        } catch (err) {
          pendingMessagesRef.current.delete(id);
          reject(err);
        }

        // Timeout after 30 seconds
        setTimeout(() => {
          const pending = pendingMessagesRef.current.get(id);
          if (pending) {
            pending.reject(new Error("Request timeout"));
            pendingMessagesRef.current.delete(id);
          }
        }, 30000);
      });
    },
    []
  );

  const subscribeToEvents = useCallback(
    (eventType: string, callback: (event: any) => void): (() => void) => {
      const id = messageIdRef.current++;
      let subscriptionActive = false;

      eventSubscriptionsRef.current.set(id, callback);

      sendMessage({
        type: "subscribe_events",
        event_type: eventType,
      })
        .then(() => {
          subscriptionActive = true;
          activeSubscriptionsRef.current.add(id);
        })
        .catch((err) => {
          console.error("Failed to subscribe to events:", err);
          eventSubscriptionsRef.current.delete(id);
        });

      // Return unsubscribe function
      return () => {
        eventSubscriptionsRef.current.delete(id);
        activeSubscriptionsRef.current.delete(id);

        // Only send unsubscribe if the subscription was successfully created
        if (
          subscriptionActive &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          sendMessage({
            type: "unsubscribe_events",
            subscription: id,
          }).catch((err) => {
            // Silently handle unsubscribe errors (subscription may already be gone)
            console.log("Note: Unsubscribe response:", err.message);
          });
        }
      };
    },
    [sendMessage]
  );

  const getStates = useCallback(async (): Promise<any[]> => {
    const result = await sendMessage({ type: "get_states" });
    return result;
  }, [sendMessage]);

  const callService = useCallback(
    async (
      domain: string,
      service: string,
      serviceData?: any
    ): Promise<any> => {
      const result = await sendMessage({
        type: "call_service",
        domain,
        service,
        service_data: serviceData,
      });
      return result;
    },
    [sendMessage]
  );

  // Auto-connect on mount and when active home changes
  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("📱 App came to foreground");
          // Reconnect if not connected
          if (!isConnected && !isConnecting && shouldReconnect.current) {
            connect();
          }
        }
        appStateRef.current = nextAppState;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [connect, isConnected, isConnecting]);

  const value: HomeAssistantContextType = {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    subscribeToEvents,
    getStates,
    callService,
    currentConfig,
  };

  return (
    <HomeAssistantContext.Provider value={value}>
      {children}
    </HomeAssistantContext.Provider>
  );
};
