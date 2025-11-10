import { ConnectionStatus } from "./ConnectionStatus";
import { ThemeToggle } from "./theme-toggle";

type ConnectionState = "connected" | "connecting" | "disconnected" | "error";

interface HeaderProps {
  connectionState: ConnectionState;
}

export function Header({ connectionState }: HeaderProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-5xl font-bold tracking-tight mb-3">Task Manager</h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            A fullstack CRUD app with Rust (Axum + SQLx + WebSocket) and React (Next.js + Zustand + shadcn/ui)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus state={connectionState} />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
