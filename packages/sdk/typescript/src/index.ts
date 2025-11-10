/**
 * Starter SDK - TypeScript client for the REST API
 *
 * @example
 * ```typescript
 * import { ApiClient } from '@rust-react-starter/sdk';
 *
 * const client = new ApiClient('http://localhost:8888');
 *
 * // Get all todos
 * const todos = await client.listTodos();
 *
 * // Create a new todo
 * const newTodo = await client.createTodo({
 *   title: 'Learn Rust',
 *   description: 'Build a fullstack app with Rust and React'
 * });
 * ```
 */

import type { components, paths } from "./types/generated/rest";
import type { ApiTodo, ClientMessage, ServerMessage, ConnectionState } from "./types/generated/websocket";
import { WebSocketClient } from "./websocket-client";

export { ApiError } from "./errors";

// Export generated types
export type { components, paths };

// Export WebSocket types and client
export type { ApiTodo, ClientMessage, ServerMessage, ConnectionState };
export { WebSocketClient };

// Extract types from OpenAPI components
export type TodoRequest = components["schemas"]["TodoRequest"];
export type TodoResponse = components["schemas"]["TodoResponse"];

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  enableWebSocket?: boolean;
  websocketConfig?: {
    reconnect?: boolean;
    reconnectDelay?: number;
    pingInterval?: number;
  };
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  public ws: WebSocketClient | null = null;

  constructor(baseUrl: string);
  constructor(config: ApiClientConfig);
  constructor(config: string | ApiClientConfig) {
    if (typeof config === "string") {
      this.baseUrl = config.replace(/\/$/, "");
      this.timeout = 30000;
    } else {
      this.baseUrl = config.baseUrl.replace(/\/$/, "");
      this.timeout = config.timeout ?? 30000;

      // Initialize WebSocket if enabled
      if (config.enableWebSocket) {
        const wsUrl = this.baseUrl.replace(/^http/, "ws") + "/ws";
        this.ws = new WebSocketClient({
          url: wsUrl,
          ...config.websocketConfig,
        });
        this.ws.connect();
      }
    }
  }

  // ============================================================================
  // WebSocket Methods
  // ============================================================================

  /**
   * Create a todo via WebSocket
   */
  createTodoWs(title: string, description?: string): void {
    this.ws?.send({ type: "create", title, description });
  }

  /**
   * Update a todo via WebSocket
   */
  updateTodoWs(id: string, updates: { title?: string; description?: string; completed?: boolean }): void {
    this.ws?.send({ type: "update", id, ...updates });
  }

  /**
   * Delete a todo via WebSocket
   */
  deleteTodoWs(id: string): void {
    this.ws?.send({ type: "delete", id });
  }

  /**
   * Toggle a todo's completion status via WebSocket
   */
  toggleTodoWs(id: string): void {
    this.ws?.send({ type: "toggle", id });
  }

  /**
   * Get the current WebSocket connection state
   */
  getConnectionState(): ConnectionState {
    return this.ws?.getState() || "disconnected";
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.getState() === "connected";
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.ws?.disconnect();
  }

  // ============================================================================
  // Todo Endpoints (REST)
  // ============================================================================

  /**
   * Get all todos
   */
  async listTodos(): Promise<ApiTodo[]> {
    const response = await this.post<TodoResponse>("/api/todos", { type: "list" });
    if (response.type === "list") {
      return response.todos;
    }
    throw new Error("Unexpected response type");
  }

  /**
   * Get a single todo by ID
   */
  async getTodo(id: string): Promise<ApiTodo> {
    const response = await this.post<TodoResponse>("/api/todos", { type: "get", id });
    if (response.type === "todo") {
      return response.todo;
    }
    throw new Error("Unexpected response type");
  }

  /**
   * Create a new todo
   */
  async createTodo(title: string, description?: string): Promise<ApiTodo> {
    const response = await this.post<TodoResponse>("/api/todos", {
      type: "create",
      title,
      description,
    });
    if (response.type === "todo") {
      return response.todo;
    }
    throw new Error("Unexpected response type");
  }

  /**
   * Update an existing todo
   */
  async updateTodo(
    id: string,
    updates: { title?: string; description?: string; completed?: boolean }
  ): Promise<ApiTodo> {
    const response = await this.post<TodoResponse>("/api/todos", {
      type: "update",
      id,
      ...updates,
    });
    if (response.type === "todo") {
      return response.todo;
    }
    throw new Error("Unexpected response type");
  }

  /**
   * Delete a todo
   */
  async deleteTodo(id: string): Promise<string> {
    const response = await this.post<TodoResponse>("/api/todos", { type: "delete", id });
    if (response.type === "deleted") {
      return response.id;
    }
    throw new Error("Unexpected response type");
  }

  // ============================================================================
  // HTTP Helpers
  // ============================================================================

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        const { ApiError } = await import("./errors");
        throw new ApiError(error.error || "Request failed", response.status, error.code);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "ApiError") {
        throw error;
      }
      const { ApiError } = await import("./errors");
      throw new ApiError("Network error", 0, undefined, error);
    }
  }
}
