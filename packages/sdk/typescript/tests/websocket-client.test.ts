import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { WebSocketClient } from "../src/websocket-client";
import { ApiClient } from "../src/index";
import type { ServerMessage, ApiTodo } from "../src/types/generated/websocket";
import { BackendTestServer } from "@rust-react-starter/test-utils";

describe("WebSocketClient Integration Tests", () => {
  let server: BackendTestServer;
  let wsUrl: string;

  beforeAll(async () => {
    server = await BackendTestServer.start();
    wsUrl = server.getFullWsUrl();
  }, 120000); // 2 minute timeout for container startup

  afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  describe("Connection Management", () => {
    test("should connect to WebSocket server", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const states: string[] = [];
      client.onStateChange((state) => states.push(state));

      client.connect();

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(states).toContain("connecting");
      expect(states).toContain("connected");
      expect(client.getState()).toBe("connected");

      client.disconnect();
    });

    test("should receive connected message with initial todos", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const messages: ServerMessage[] = [];
      client.on("connected", (msg) => messages.push(msg));

      client.connect();

      // Wait for connection message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe("connected");
      if (messages[0].type === "connected") {
        expect(messages[0].client_id).toBeDefined();
        expect(Array.isArray(messages[0].todos)).toBe(true);
      }

      client.disconnect();
    });

    test("should disconnect cleanly", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(client.getState()).toBe("connected");

      client.disconnect();

      // Wait for disconnect to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(client.getState()).toBe("disconnected");
    });
  });

  describe("Create Todo via WebSocket", () => {
    test("should create a todo and receive created message", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const createdMessages: ServerMessage[] = [];
      client.on("created", (msg) => createdMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send create message
      client.send({
        type: "create",
        title: "WebSocket Todo",
        description: "Created via WebSocket",
      });

      // Wait for response
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(createdMessages.length).toBeGreaterThan(0);
      const message = createdMessages[0];
      expect(message.type).toBe("created");
      if (message.type === "created") {
        expect(message.todo.title).toBe("WebSocket Todo");
        expect(message.todo.description).toBe("Created via WebSocket");
        expect(message.todo.completed).toBe(false);
      }

      client.disconnect();
    });

    test("should create a todo without description", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const createdMessages: ServerMessage[] = [];
      client.on("created", (msg) => createdMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.send({
        type: "create",
        title: "Simple WebSocket Todo",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(createdMessages.length).toBeGreaterThan(0);
      if (createdMessages[0].type === "created") {
        expect(createdMessages[0].todo.title).toBe("Simple WebSocket Todo");
        expect(createdMessages[0].todo.description).toBeNull();
      }

      client.disconnect();
    });
  });

  describe("Update Todo via WebSocket", () => {
    test("should update a todo and receive updated message", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const createdMessages: ServerMessage[] = [];
      const updatedMessages: ServerMessage[] = [];
      client.on("created", (msg) => createdMessages.push(msg));
      client.on("updated", (msg) => updatedMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create a todo
      client.send({
        type: "create",
        title: "Todo to Update",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(createdMessages.length).toBeGreaterThan(0);
      const todoId = createdMessages[0].type === "created" ? createdMessages[0].todo.id : "";

      // Update the todo
      client.send({
        type: "update",
        id: todoId,
        title: "Updated via WebSocket",
        description: "New description",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(updatedMessages.length).toBeGreaterThan(0);
      if (updatedMessages[0].type === "updated") {
        expect(updatedMessages[0].todo.id).toBe(todoId);
        expect(updatedMessages[0].todo.title).toBe("Updated via WebSocket");
        expect(updatedMessages[0].todo.description).toBe("New description");
      }

      client.disconnect();
    });
  });

  describe("Toggle Todo via WebSocket", () => {
    test("should toggle todo completion status", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const createdMessages: ServerMessage[] = [];
      const updatedMessages: ServerMessage[] = [];
      client.on("created", (msg) => createdMessages.push(msg));
      client.on("updated", (msg) => updatedMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create a todo
      client.send({
        type: "create",
        title: "Todo to Toggle",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const todoId = createdMessages[0].type === "created" ? createdMessages[0].todo.id : "";

      // Toggle it
      client.send({
        type: "toggle",
        id: todoId,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(updatedMessages.length).toBeGreaterThan(0);
      if (updatedMessages[0].type === "updated") {
        expect(updatedMessages[0].todo.completed).toBe(true);
      }

      // Toggle it back
      client.send({
        type: "toggle",
        id: todoId,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (updatedMessages[1].type === "updated") {
        expect(updatedMessages[1].todo.completed).toBe(false);
      }

      client.disconnect();
    });
  });

  describe("Delete Todo via WebSocket", () => {
    test("should delete a todo and receive deleted message", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const createdMessages: ServerMessage[] = [];
      const deletedMessages: ServerMessage[] = [];
      client.on("created", (msg) => createdMessages.push(msg));
      client.on("deleted", (msg) => deletedMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create a todo
      client.send({
        type: "create",
        title: "Todo to Delete",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const todoId = createdMessages[0].type === "created" ? createdMessages[0].todo.id : "";

      // Delete it
      client.send({
        type: "delete",
        id: todoId,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(deletedMessages.length).toBeGreaterThan(0);
      if (deletedMessages[0].type === "deleted") {
        expect(deletedMessages[0].id).toBe(todoId);
      }

      client.disconnect();
    });
  });

  describe("Multiple Handlers", () => {
    test("should call multiple handlers for same message type", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const messages1: ServerMessage[] = [];
      const messages2: ServerMessage[] = [];

      client.on("created", (msg) => messages1.push(msg));
      client.on("created", (msg) => messages2.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.send({
        type: "create",
        title: "Multiple Handlers Test",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(messages1.length).toBeGreaterThan(0);
      expect(messages2.length).toBeGreaterThan(0);
      expect(messages1.length).toBe(messages2.length);

      client.disconnect();
    });

    test("should unsubscribe from handlers", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const messages: ServerMessage[] = [];
      const unsubscribe = client.on("created", (msg) => messages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send first message
      client.send({
        type: "create",
        title: "Before Unsubscribe",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const countBefore = messages.length;
      expect(countBefore).toBeGreaterThan(0);

      // Unsubscribe
      unsubscribe();

      // Send second message
      client.send({
        type: "create",
        title: "After Unsubscribe",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should not have increased
      expect(messages.length).toBe(countBefore);

      client.disconnect();
    });
  });

  describe("Error Handling", () => {
    test("should receive error message for invalid operation", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const errorMessages: ServerMessage[] = [];
      client.on("error", (msg) => errorMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to update non-existent todo
      client.send({
        type: "update",
        id: "00000000-0000-0000-0000-000000000000",
        title: "Should Fail",
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(errorMessages.length).toBeGreaterThan(0);
      if (errorMessages[0].type === "error") {
        expect(errorMessages[0].message).toBeDefined();
      }

      client.disconnect();
    });
  });

  describe("ApiClient WebSocket Integration", () => {
    test("should create client with WebSocket enabled", async () => {
      const client = new ApiClient({
        baseUrl: server.getApiUrl(),
        enableWebSocket: true,
      });

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(client.ws).not.toBeNull();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
    });

    test("should create todo via WebSocket using ApiClient", async () => {
      const client = new ApiClient({
        baseUrl: server.getApiUrl(),
        enableWebSocket: true,
      });

      const messages: ServerMessage[] = [];
      client.ws?.on("created", (msg) => messages.push(msg));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.createTodoWs("ApiClient WebSocket Test", "Test description");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(messages.length).toBeGreaterThan(0);
      if (messages[0].type === "created") {
        expect(messages[0].todo.title).toBe("ApiClient WebSocket Test");
      }

      client.disconnect();
    });

    test("should update todo via WebSocket using ApiClient", async () => {
      const client = new ApiClient({
        baseUrl: server.getApiUrl(),
        enableWebSocket: true,
      });

      const createdMessages: ServerMessage[] = [];
      const updatedMessages: ServerMessage[] = [];
      client.ws?.on("created", (msg) => createdMessages.push(msg));
      client.ws?.on("updated", (msg) => updatedMessages.push(msg));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.createTodoWs("Todo for ApiClient Update");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const todoId = createdMessages[0].type === "created" ? createdMessages[0].todo.id : "";

      client.updateTodoWs(todoId, { title: "Updated Title" });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(updatedMessages.length).toBeGreaterThan(0);
      if (updatedMessages[0].type === "updated") {
        expect(updatedMessages[0].todo.title).toBe("Updated Title");
      }

      client.disconnect();
    });

    test("should toggle todo via WebSocket using ApiClient", async () => {
      const client = new ApiClient({
        baseUrl: server.getApiUrl(),
        enableWebSocket: true,
      });

      const createdMessages: ServerMessage[] = [];
      const updatedMessages: ServerMessage[] = [];
      client.ws?.on("created", (msg) => createdMessages.push(msg));
      client.ws?.on("updated", (msg) => updatedMessages.push(msg));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.createTodoWs("Todo for Toggle");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const todoId = createdMessages[0].type === "created" ? createdMessages[0].todo.id : "";

      client.toggleTodoWs(todoId);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(updatedMessages.length).toBeGreaterThan(0);
      if (updatedMessages[0].type === "updated") {
        expect(updatedMessages[0].todo.completed).toBe(true);
      }

      client.disconnect();
    });

    test("should delete todo via WebSocket using ApiClient", async () => {
      const client = new ApiClient({
        baseUrl: server.getApiUrl(),
        enableWebSocket: true,
      });

      const createdMessages: ServerMessage[] = [];
      const deletedMessages: ServerMessage[] = [];
      client.ws?.on("created", (msg) => createdMessages.push(msg));
      client.ws?.on("deleted", (msg) => deletedMessages.push(msg));

      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.createTodoWs("Todo for Delete");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const todoId = createdMessages[0].type === "created" ? createdMessages[0].todo.id : "";

      client.deleteTodoWs(todoId);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(deletedMessages.length).toBeGreaterThan(0);
      if (deletedMessages[0].type === "deleted") {
        expect(deletedMessages[0].id).toBe(todoId);
      }

      client.disconnect();
    });
  });

  describe("Ping/Pong", () => {
    test("should send ping and receive pong", async () => {
      const client = new WebSocketClient({ url: wsUrl });

      const pongMessages: ServerMessage[] = [];
      client.on("pong", (msg) => pongMessages.push(msg));

      client.connect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      client.send({ type: "ping" });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(pongMessages.length).toBeGreaterThan(0);
      expect(pongMessages[0].type).toBe("pong");

      client.disconnect();
    });
  });
});
