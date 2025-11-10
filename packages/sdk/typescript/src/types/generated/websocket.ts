/**
 * WebSocket Message Types
 * Generated from Rust types via JSON Schema
 * DO NOT EDIT MANUALLY
 */

/**
 * Messages sent from client to server
 */
export type ClientMessage =
  | {
      description?: string | null;
      title: string;
      type: "create";
      [k: string]: unknown;
    }
  | {
      completed?: boolean | null;
      description?: string | null;
      id: string;
      title?: string | null;
      type: "update";
      [k: string]: unknown;
    }
  | {
      id: string;
      type: "delete";
      [k: string]: unknown;
    }
  | {
      id: string;
      type: "toggle";
      [k: string]: unknown;
    }
  | {
      type: "ping";
      [k: string]: unknown;
    };


/**
 * Messages sent from server to client
 */
export type ServerMessage =
  | {
      client_id: string;
      todos: ApiTodo[];
      type: "connected";
      [k: string]: unknown;
    }
  | {
      todo: ApiTodo;
      type: "created";
      [k: string]: unknown;
    }
  | {
      todo: ApiTodo;
      type: "updated";
      [k: string]: unknown;
    }
  | {
      id: string;
      type: "deleted";
      [k: string]: unknown;
    }
  | {
      message: string;
      type: "error";
      [k: string]: unknown;
    }
  | {
      type: "pong";
      [k: string]: unknown;
    };

/**
 * API representation of a Todo item
 */
export interface ApiTodo {
  completed: boolean;
  created_at: string;
  description?: string | null;
  id: string;
  title: string;
  updated_at: string;
  [k: string]: unknown;
}


export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";
