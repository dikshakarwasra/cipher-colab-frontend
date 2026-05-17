import { Circle, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ConnectionState = "connected" | "connecting" | "disconnected" | "error";

interface ConnectionStatusProps {
  state: ConnectionState;
  latency?: number;
  lastSyncTime?: number;
}

/**
 * Connection Status Component
 * Displays real-time connection state and latency information
 */
export default function ConnectionStatus({
  state,
  latency,
  lastSyncTime,
}: ConnectionStatusProps) {
  const getStatusConfig = (s: ConnectionState) => {
    switch (s) {
      case "connected":
        return {
          color: "#2ECC71",
          icon: Wifi,
          label: "Connected",
          description: "Real-time sync active",
        };
      case "connecting":
        return {
          color: "#FFB74D",
          icon: Wifi,
          label: "Connecting",
          description: "Establishing connection",
        };
      case "disconnected":
        return {
          color: "#999999",
          icon: WifiOff,
          label: "Offline",
          description: "No connection",
        };
      case "error":
        return {
          color: "#E53935",
          icon: AlertTriangle,
          label: "Error",
          description: "Connection error",
        };
    }
  };

  const config = getStatusConfig(state);
  const Icon = config.icon;

  const formatLatency = (ms: number) => {
    if (ms < 100) return `${ms}ms (excellent)`;
    if (ms < 200) return `${ms}ms (good)`;
    if (ms < 500) return `${ms}ms (fair)`;
    return `${ms}ms (slow)`;
  };

  const formatLastSync = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 1) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
          <Circle
            className="w-2 h-2 flex-shrink-0"
            style={{
              fill: config.color,
              color: config.color,
            }}
          />
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: config.color }} />
          <span className="text-sm font-medium text-foreground">
            {config.label}
          </span>
          {latency && state === "connected" && (
            <span className="text-xs text-muted-foreground ml-1">
              {latency}ms
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-2">
          <p className="font-semibold">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          {latency && state === "connected" && (
            <p className="text-xs">Latency: {formatLatency(latency)}</p>
          )}
          {lastSyncTime && state === "connected" && (
            <p className="text-xs">Last sync: {formatLastSync(lastSyncTime)}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
