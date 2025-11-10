import type { ClientMessage, ServerMessage, ConnectionState } from "./types/generated/websocket";

export interface WebSocketClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  pingInterval?: number;
}

type MessageType = ServerMessage["type"];
type MessageHandler<T = ServerMessage> = (message: T) => void;
type StateHandler = (state: ConnectionState) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnect: boolean;
  private reconnectDelay: number;
  private pingInterval: number;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingTimeout: ReturnType<typeof setTimeout> | null = null;
  private state: ConnectionState = "disconnected";

  private messageHandlers = new Map<MessageType, Set<MessageHandler>>();
  private stateHandlers = new Set<StateHandler>();

  constructor(config: WebSocketClientConfig) {
    this.url = config.url;
    this.reconnect = config.reconnect ?? true;
    this.reconnectDelay = config.reconnectDelay ?? 3000;
    this.pingInterval = config.pingInterval ?? 30000; // Ping every 30 seconds
  }

  /**
   * Register a message handler for a specific message type
   * Returns an unsubscribe function
   */
  on<T extends MessageType>(type: T, handler: MessageHandler<Extract<ServerMessage, { type: T }>>): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
      }
    };
  }

  /**
   * Register a connection state change handler
   * Returns an unsubscribe function
   */
  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);

    // Call handler with current state immediately
    handler(this.state);

    // Return unsubscribe function
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setState("connected");
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        // Start ping/pong heartbeat
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          this.handleMessage(message);

          // Reset ping timer on any message received
          if (message.type === "pong") {
            this.startPing();
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = () => {
        this.setState("error");
        this.stopPing();
      };

      this.ws.onclose = () => {
        this.setState("disconnected");
        this.stopPing();
        if (this.reconnect && this.state !== "error") {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.setState("error");
      console.error("WebSocket connection error:", error);
    }
  }

  disconnect(): void {
    this.reconnect = false;
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Handle incoming WebSocket message by dispatching to registered handlers
   */
  private handleMessage(message: ServerMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected");
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateHandlers.forEach((handler) => handler(state));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimeout = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" });
      }
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }
}
