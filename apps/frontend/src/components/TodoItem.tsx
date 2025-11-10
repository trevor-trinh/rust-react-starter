"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Pencil, Check, X } from "lucide-react";
import type { Todo } from "@/lib/types";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, updates: { title?: string; description?: string }) => void;
}

export function TodoItem({ todo, onToggle, onDelete, onEdit }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDescription, setEditDescription] = useState(todo.description || "");

  const handleSave = () => {
    if (editTitle.trim()) {
      onEdit(todo.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(todo.title);
    setEditDescription(todo.description || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.2 }}
        className="border-b border-border last:border-0 bg-muted/30"
      >
        <div className="flex items-start gap-4 py-6 px-2 -mx-2">
          <div className="pt-1.5">
            <Checkbox disabled checked={todo.completed} />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                handleKeyDown(e);
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Task title"
              className="font-medium"
              autoFocus
            />
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Description (optional)"
              className="min-h-[60px] text-sm resize-none"
            />
          </div>
          <div className="shrink-0 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="text-green-600 hover:text-green-700 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">Save</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancel</span>
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className="group border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
    >
      <label htmlFor={`todo-${todo.id}`} className="flex items-start gap-4 py-6 px-2 -mx-2 cursor-pointer">
        <div className="pt-1.5 z-10">
          <Checkbox id={`todo-${todo.id}`} checked={todo.completed} onCheckedChange={() => onToggle(todo.id)} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-base font-medium mb-1 transition-all ${
              todo.completed ? "line-through text-muted-foreground opacity-60" : "text-foreground"
            }`}
          >
            {todo.title}
          </div>
          {todo.description && <p className="text-sm text-muted-foreground leading-relaxed mb-2">{todo.description}</p>}
          <p className="text-xs text-muted-foreground">
            {todo.createdAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              setIsEditing(true);
            }}
            className="text-muted-foreground hover:text-foreground hover:scale-110 cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              onDelete(todo.id);
            }}
            className="text-muted-foreground hover:text-destructive hover:scale-110 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </label>
    </motion.div>
  );
}
