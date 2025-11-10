/**
 * Global state management with Zustand
 */

"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ApiClient } from "@rust-react-starter/sdk";
import type { Todo, ConnectionState, ServerMessage } from "./types";
import { fromApiTodo } from "./types/todo";

// ============================================================================
// State Interface
// ============================================================================

interface TodosState {
  // Data
  todos: Todo[];
  loading: boolean;
  error: string | null;
  connectionState: ConnectionState;

  // Internal
  _client: ApiClient | null;

  // Actions
  setClient: (client: ApiClient) => void;
  setTodos: (todos: Todo[]) => void;
  handleMessage: (message: ServerMessage) => void;
  handleConnectionState: (state: ConnectionState) => void;
  createTodo: (title: string, description?: string) => void;
  updateTodo: (id: string, updates: { title?: string; description?: string; completed?: boolean }) => void;
  deleteTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
  clearError: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  todos: [] as Todo[],
  loading: true,
  error: null as string | null,
  connectionState: "connecting" as ConnectionState,
  _client: null as ApiClient | null,
};

// ============================================================================
// Store
// ============================================================================

export const useTodosStore = create<TodosState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      setClient: (client) =>
        set((state) => {
          state._client = client;
        }),

      setTodos: (todos) =>
        set((state) => {
          state.todos = todos;
          state.loading = false;
        }),

      handleMessage: (message) =>
        set((state) => {
          switch (message.type) {
            case "connected":
              state.todos = message.todos.map(fromApiTodo);
              state.loading = false;
              state.connectionState = "connected";
              break;

            case "created":
              state.todos.unshift(fromApiTodo(message.todo));
              break;

            case "updated":
              const updateIndex = state.todos.findIndex((todo) => todo.id === message.todo.id);
              if (updateIndex !== -1) {
                state.todos[updateIndex] = fromApiTodo(message.todo);
              }
              break;

            case "deleted":
              state.todos = state.todos.filter((todo) => todo.id !== message.id);
              break;

            case "error":
              state.error = message.message;
              break;

            case "pong":
              // Heartbeat received - connection is alive
              break;
          }
        }),

      handleConnectionState: (connectionState) =>
        set((state) => {
          state.connectionState = connectionState;
          if (connectionState === "connected") {
            state.loading = false;
          } else if (connectionState === "connecting") {
            state.loading = true;
          }
        }),

      createTodo: (title, description) => {
        const client = get()._client;
        if (client) {
          client.createTodoWs(title, description);
        }
      },

      updateTodo: (id, updates) => {
        const client = get()._client;
        if (client) {
          client.updateTodoWs(id, updates);
        }
      },

      deleteTodo: (id) => {
        const client = get()._client;
        if (client) {
          client.deleteTodoWs(id);
        }
      },

      toggleTodo: (id) => {
        const client = get()._client;
        if (client) {
          client.toggleTodoWs(id);
        }
      },

      clearError: () =>
        set((state) => {
          state.error = null;
        }),
    })),
    { name: "TodosStore" }
  )
);
