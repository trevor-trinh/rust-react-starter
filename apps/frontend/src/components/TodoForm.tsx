"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText } from "lucide-react";

interface TodoFormProps {
  onSubmit: (title: string, description?: string) => void;
}

export function TodoForm({ onSubmit }: TodoFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit(title, description || undefined);
    setTitle("");
    setDescription("");
    setShowDescription(false);
  };

  return (
    <div className="border-b border-border pb-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg h-12 border-2 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground transition-all"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (showDescription) {
                    setShowDescription(false);
                    setDescription("");
                  } else {
                    setShowDescription(true);
                  }
                }}
                className="h-8 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <FileText className="h-4 w-4 mr-2" />
                {showDescription ? "Hide description" : "Add description"}
              </Button>
            </motion.div>
          </div>
          <Button type="submit" disabled={!title.trim()} size="lg" className="h-12 px-6">
            <Plus className="h-5 w-5 mr-2" />
            Add Task
          </Button>
        </div>

        <AnimatePresence>
          {showDescription && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="relative"
            >
              <Textarea
                placeholder="Add a description (optional)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px] resize-none border-2 focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-foreground transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
