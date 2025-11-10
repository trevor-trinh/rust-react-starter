"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TodoItem } from "./TodoItem";
import { CheckCircle2 } from "lucide-react";
import type { Todo } from "@/lib/types";

interface TodoListProps {
  todos: Todo[];
  loading: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, updates: { title?: string; description?: string }) => void;
}

export function TodoList({ todos, loading, onToggle, onDelete, onEdit }: TodoListProps) {
  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-muted-foreground">Loading tasks...</p>
      </motion.div>
    );
  }

  if (todos.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center py-20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        >
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        </motion.div>
        <h3 className="text-xl font-medium mb-2">No tasks yet</h3>
        <p className="text-muted-foreground">Add a task above to get started</p>
      </motion.div>
    );
  }

  const remainingTasks = todos.filter((t) => !t.completed).length;
  const completedTasks = todos.filter((t) => t.completed).length;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <h2 className="text-xl font-semibold">
          {remainingTasks > 0 ? (
            <>
              {remainingTasks} task{remainingTasks === 1 ? "" : "s"} remaining
            </>
          ) : (
            "All tasks completed"
          )}
        </h2>
        <div className="text-sm text-muted-foreground">
          {completedTasks} / {todos.length} completed
        </div>
      </motion.div>
      <AnimatePresence mode="popLayout">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </AnimatePresence>
    </div>
  );
}
