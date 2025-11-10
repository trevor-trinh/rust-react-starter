/**
 * Todo domain types for the frontend
 */

import type { ApiTodo } from "@rust-react-starter/sdk";

// ============================================================================
// Todo Types
// ============================================================================

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Type Conversions
// ============================================================================

/**
 * Convert API todo to frontend todo
 */
export function fromApiTodo(apiTodo: ApiTodo): Todo {
  return {
    id: apiTodo.id,
    title: apiTodo.title,
    description: apiTodo.description ?? null,
    completed: apiTodo.completed,
    createdAt: new Date(apiTodo.created_at),
    updatedAt: new Date(apiTodo.updated_at),
  };
}

/**
 * Convert frontend todo to API format (partial for updates)
 */
export function toApiTodo(todo: Partial<Todo>): {
  title?: string;
  description?: string;
  completed?: boolean;
} {
  return {
    ...(todo.title !== undefined && { title: todo.title }),
    ...(todo.description !== undefined && { description: todo.description ?? undefined }),
    ...(todo.completed !== undefined && { completed: todo.completed }),
  };
}
