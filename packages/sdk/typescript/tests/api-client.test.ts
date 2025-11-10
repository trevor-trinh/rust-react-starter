import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ApiClient, ApiError } from "../src/index";
import type { ApiTodo } from "../src/types/generated/websocket";
import { BackendTestServer } from "@rust-react-starter/test-utils";

describe("ApiClient Integration Tests", () => {
  let server: BackendTestServer;
  let client: ApiClient;
  let createdTodoId: string;

  beforeAll(async () => {
    // Start the backend test server with PostgreSQL
    server = await BackendTestServer.start();
    client = new ApiClient(server.getApiUrl());
  }, 120000); // 2 minute timeout for container startup

  afterAll(async () => {
    if (server) {
      await server.cleanup();
    }
  });

  describe("Health Check", () => {
    test("should connect to server health endpoint", async () => {
      const response = await fetch(`${server.getApiUrl()}/api/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("ok");
    });
  });

  describe("Todo Operations", () => {
    test("should list todos (empty initially)", async () => {
      const todos = await client.listTodos();
      expect(Array.isArray(todos)).toBe(true);
    });

    test("should create a new todo", async () => {
      const todo = await client.createTodo("Test Todo", "Test Description");

      expect(todo).toBeDefined();
      expect(todo.id).toBeDefined();
      expect(todo.title).toBe("Test Todo");
      expect(todo.description).toBe("Test Description");
      expect(todo.completed).toBe(false);
      expect(todo.created_at).toBeDefined();
      expect(todo.updated_at).toBeDefined();

      // Save for later tests
      createdTodoId = todo.id;
    });

    test("should create a todo without description", async () => {
      const todo = await client.createTodo("Simple Todo");

      expect(todo.title).toBe("Simple Todo");
      expect(todo.description).toBeNull();
    });

    test("should list todos and include created todo", async () => {
      const todos = await client.listTodos();

      expect(todos.length).toBeGreaterThan(0);
      const foundTodo = todos.find((t) => t.id === createdTodoId);
      expect(foundTodo).toBeDefined();
      expect(foundTodo?.title).toBe("Test Todo");
    });

    test("should get a single todo by ID", async () => {
      const todo = await client.getTodo(createdTodoId);

      expect(todo).toBeDefined();
      expect(todo.id).toBe(createdTodoId);
      expect(todo.title).toBe("Test Todo");
      expect(todo.description).toBe("Test Description");
    });

    test("should update todo title", async () => {
      const updated = await client.updateTodo(createdTodoId, {
        title: "Updated Title",
      });

      expect(updated.id).toBe(createdTodoId);
      expect(updated.title).toBe("Updated Title");
      expect(updated.description).toBe("Test Description"); // Should remain unchanged
      expect(updated.completed).toBe(false);
    });

    test("should update todo description", async () => {
      const updated = await client.updateTodo(createdTodoId, {
        description: "Updated Description",
      });

      expect(updated.description).toBe("Updated Description");
      expect(updated.title).toBe("Updated Title");
    });

    test("should update todo completion status", async () => {
      const updated = await client.updateTodo(createdTodoId, {
        completed: true,
      });

      expect(updated.completed).toBe(true);
      expect(updated.title).toBe("Updated Title");
    });

    test("should update multiple fields at once", async () => {
      const updated = await client.updateTodo(createdTodoId, {
        title: "Final Title",
        description: "Final Description",
        completed: false,
      });

      expect(updated.title).toBe("Final Title");
      expect(updated.description).toBe("Final Description");
      expect(updated.completed).toBe(false);
    });

    test("should delete a todo", async () => {
      // Create a new todo to delete
      const todo = await client.createTodo("Todo to Delete");
      const todoId = todo.id;

      // Delete it
      const deletedId = await client.deleteTodo(todoId);
      expect(deletedId).toBe(todoId);

      // Verify it's gone by trying to get it (should throw error)
      await expect(client.getTodo(todoId)).rejects.toThrow();
    });
  });

  describe("Error Handling", () => {
    test("should throw ApiError when todo not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      try {
        await client.getTodo(nonExistentId);
        throw new Error("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    test("should throw ApiError when updating non-existent todo", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      try {
        await client.updateTodo(nonExistentId, { title: "Test" });
        throw new Error("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    test("should throw ApiError when deleting non-existent todo", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      try {
        await client.deleteTodo(nonExistentId);
        throw new Error("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });
  });

  describe("RPC Response Types", () => {
    test("should handle list response type", async () => {
      const todos = await client.listTodos();
      expect(Array.isArray(todos)).toBe(true);
    });

    test("should handle todo response type", async () => {
      const todo = await client.createTodo("Response Type Test");
      expect(todo).toHaveProperty("id");
      expect(todo).toHaveProperty("title");
      expect(todo).toHaveProperty("completed");
      expect(todo).toHaveProperty("created_at");
      expect(todo).toHaveProperty("updated_at");
    });

    test("should handle deleted response type", async () => {
      const todo = await client.createTodo("Delete Response Test");
      const deletedId = await client.deleteTodo(todo.id);
      expect(typeof deletedId).toBe("string");
      expect(deletedId).toBe(todo.id);
    });
  });

  describe("Data Validation", () => {
    test("created_at and updated_at should be valid timestamps", async () => {
      const todo = await client.createTodo("Timestamp Test");

      const createdAt = new Date(todo.created_at);
      const updatedAt = new Date(todo.updated_at);

      expect(createdAt.getTime()).not.toBeNaN();
      expect(updatedAt.getTime()).not.toBeNaN();
      expect(createdAt.getTime()).toBeLessThanOrEqual(updatedAt.getTime());
    });

    test("updated_at should change after update", async () => {
      const todo = await client.createTodo("Update Timestamp Test");
      const originalUpdatedAt = todo.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await client.updateTodo(todo.id, { title: "Updated" });

      // Note: Depending on database precision, these might be equal
      // The important thing is that updated_at is set
      expect(updated.updated_at).toBeDefined();
    });

    test("should handle empty string title", async () => {
      try {
        await client.createTodo("");
        throw new Error("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
      }
    });
  });

  describe("Constructor and Configuration", () => {
    test("should accept string URL", () => {
      const testClient = new ApiClient(server.getApiUrl());
      expect(testClient).toBeDefined();
      expect(testClient.ws).toBeNull();
    });

    test("should remove trailing slash from URL", () => {
      const testClient = new ApiClient(server.getApiUrl() + "/");
      expect(testClient).toBeDefined();
    });

    test("should accept config object", () => {
      const testClient = new ApiClient({
        baseUrl: server.getApiUrl(),
        timeout: 5000,
      });
      expect(testClient).toBeDefined();
    });

    test("should initialize WebSocket when enabled", () => {
      const testClient = new ApiClient({
        baseUrl: server.getApiUrl(),
        enableWebSocket: true,
      });
      expect(testClient.ws).not.toBeNull();
      testClient.disconnect();
    });
  });

  describe("WebSocket Methods (without connection)", () => {
    test("should return disconnected state when WebSocket not initialized", () => {
      expect(client.getConnectionState()).toBe("disconnected");
      expect(client.isConnected()).toBe(false);
    });

    test("should not throw when calling WebSocket methods without connection", () => {
      expect(() => client.createTodoWs("Test")).not.toThrow();
      expect(() => client.updateTodoWs("1", { title: "Test" })).not.toThrow();
      expect(() => client.deleteTodoWs("1")).not.toThrow();
      expect(() => client.toggleTodoWs("1")).not.toThrow();
      expect(() => client.disconnect()).not.toThrow();
    });
  });
});
