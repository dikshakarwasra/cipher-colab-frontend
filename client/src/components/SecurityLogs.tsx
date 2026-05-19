import { useEffect, useState } from "react";
import { api, type ApiSecurityLog } from "@/lib/api";
import { Shield, ShieldAlert, Globe, Monitor, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatLocalTimestamp } from "@/lib/time";

export default function SecurityLogs() {
  const [logs, setLogs] = useState<ApiSecurityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.securityLogs()
      .then(setLogs)
      .catch(() => toast.error("Failed to load security logs"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full bg-[rgba(17,24,39,0.75)] border-l border-white/10 max-w-md w-full backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Security Logs</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No logs found</div>
        ) : (
          <div className="divide-y divide-border/50">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    log.event.includes("failed") ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-500"
                  }`}>
                    {log.event.includes("failed") ? <ShieldAlert className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground capitalize">
                      {log.event.replaceAll("_", " ")}
                    </p>

                    <div className="mt-2 space-y-1.5">
                      {log.ip_address && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          <span>{log.ip_address}</span>
                        </div>
                      )}
                      {log.user_agent && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Monitor className="h-3 w-3" />
                          <span className="truncate" title={log.user_agent}>{log.user_agent}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatLocalTimestamp(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
