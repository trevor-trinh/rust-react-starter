/**
 * Hook for managing todos with REST API initial fetch and WebSocket updates
 */

"use client";

import { useEffect, useRef } from "react";
import { useApiClient } from "./useApiClient";
import { useTodosStore } from "../store";
import { fromApiTodo } from "../types/todo";

/**
 * Hook that:
 * 1. Initializes the API client and WebSocket connection
 * 2. Fetches todos via REST API on mount
 * 3. Keeps todos updated via WebSocket messages
 * 4. Returns Zustand store state and actions
 */
export function useTodos() {
  // Initialize API client and WebSocket connection
  const client = useApiClient();

  // Get store state and actions
  const store = useTodosStore();

  // Track if we've already fetched to avoid duplicate fetches
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch once per component lifecycle
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    // Fetch todos via REST API
    const fetchTodos = async () => {
      try {
        const apiTodos = await client.listTodos();
        const todos = apiTodos.map(fromApiTodo);
        store.setTodos(todos);
      } catch (error) {
        console.error("Failed to fetch todos:", error);
        // Set loading to false even on error
        store.setTodos([]);
      }
    };

    fetchTodos();
  }, [client, store]);

  return store;
}
