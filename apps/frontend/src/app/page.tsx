"use client";

import { useTodos } from "@/lib/hooks";
import { Header } from "@/components/Header";
import { ErrorAlert } from "@/components/ErrorAlert";
import { TodoForm } from "@/components/TodoForm";
import { TodoList } from "@/components/TodoList";

export default function Home() {
  // Initialize API client, fetch todos via REST, and set up WebSocket updates
  const { todos, loading, error, connectionState, createTodo, updateTodo, toggleTodo, deleteTodo, clearError } =
    useTodos();

  const handleCreateTodo = (title: string, description?: string) => {
    createTodo(title, description);
  };

  const handleEditTodo = (id: string, updates: { title?: string; description?: string }) => {
    updateTodo(id, updates);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <Header connectionState={connectionState} />

        {error && <ErrorAlert error={error} onDismiss={clearError} />}

        <div className="space-y-12">
          <TodoForm onSubmit={handleCreateTodo} />

          <TodoList
            todos={todos}
            loading={loading}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            onEdit={handleEditTodo}
          />
        </div>
      </div>
    </div>
  );
}
