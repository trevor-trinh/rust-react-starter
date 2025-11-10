/**
 * Hook for accessing the ApiClient singleton
 */

"use client";

import { useMemo, useEffect } from "react";
import { ApiClient } from "@rust-react-starter/sdk";
import { useTodosStore } from "../store";

// Module-level singleton
let _apiClient: ApiClient | null = null;
let _initialized = false;

/**
 * Get or create the singleton ApiClient instance.
 * Lazily initializes to avoid SSR issues with environment variables.
 */
function getApiClient(): ApiClient {
  if (!_apiClient) {
    const apiUrl =
      typeof window !== "undefined"
        ? (window as Window & { __NEXT_PUBLIC_API_URL__?: string }).__NEXT_PUBLIC_API_URL__ ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8888"
        : "http://localhost:8888";

    _apiClient = new ApiClient({
      baseUrl: apiUrl,
      enableWebSocket: true,
    });

    // Get store instance
    const store = useTodosStore.getState();

    // Set client in store
    store.setClient(_apiClient);

    // Register WebSocket message handlers using the .on() pattern
    _apiClient.ws?.on("connected", (msg) => store.handleMessage(msg));
    _apiClient.ws?.on("created", (msg) => store.handleMessage(msg));
    _apiClient.ws?.on("updated", (msg) => store.handleMessage(msg));
    _apiClient.ws?.on("deleted", (msg) => store.handleMessage(msg));
    _apiClient.ws?.on("error", (msg) => store.handleMessage(msg));
    _apiClient.ws?.on("pong", (msg) => store.handleMessage(msg));

    // Register connection state handler
    _apiClient.ws?.onStateChange((state) => store.handleConnectionState(state));
  }
  return _apiClient;
}

/**
 * Hook to access the singleton ApiClient instance.
 * Returns the same instance across all components.
 */
export function useApiClient(): ApiClient {
  const client = useMemo(() => getApiClient(), []);

  useEffect(() => {
    if (!_initialized && client) {
      _initialized = true;
    }
  }, [client]);

  return client;
}
