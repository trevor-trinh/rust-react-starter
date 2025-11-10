import { Badge } from "@/components/ui/badge";

type ConnectionState = "connected" | "connecting" | "disconnected" | "error";

interface ConnectionStatusProps {
  state: ConnectionState;
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const statusConfig = {
    connected: {
      label: "Connected",
      variant: "outline" as const,
      dotColor: "bg-emerald-500 dark:bg-emerald-400",
    },
    connecting: {
      label: "Connecting...",
      variant: "outline" as const,
      dotColor: "bg-amber-500 dark:bg-amber-400",
    },
    disconnected: {
      label: "Disconnected",
      variant: "outline" as const,
      dotColor: "bg-muted-foreground",
    },
    error: {
      label: "Connection Error",
      variant: "outline" as const,
      dotColor: "bg-destructive",
    },
  };

  const config = statusConfig[state];

  return (
    <Badge variant={config.variant} className="gap-2 px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${config.dotColor} animate-pulse`} />
      <span className="text-xs font-medium">{config.label}</span>
    </Badge>
  );
}
