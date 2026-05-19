import { useEffect, useState } from "react";
import { api, type ApiVersion } from "@/lib/api";
import { History, RotateCcw, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { formatLocalTimestamp, parseServerTimestamp } from "@/lib/time";

interface VersionHistoryProps {
  workspaceId: string;
  fileId: string;
  onRestore: (file: any) => void;
}

export default function VersionHistory({ workspaceId, fileId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<ApiVersion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId || !fileId) return;
    setLoading(true);
    api.fileVersions(workspaceId, fileId)
      .then(setVersions)
      .catch(() => toast.error("Failed to load versions"))
      .finally(() => setLoading(false));
  }, [workspaceId, fileId]);

  const handleRestore = async (versionId: string) => {
    try {
      const updatedFile = await api.restoreVersion(workspaceId, fileId, versionId);
      toast.success("Version restored successfully");
      onRestore(updatedFile);
    } catch (err) {
      toast.error("Failed to restore version");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[rgba(17,24,39,0.75)] border-l border-white/10 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Version History</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No versions found</div>
        ) : (
          <div className="divide-y divide-border/50">
            {versions.map((v) => (
              <div key={v.id} className="p-4 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                      v{v.version_number}
                    </span>
                    <span className="truncate max-w-[120px]">{v.message || "Manual update"}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:text-primary"
                    onClick={() => handleRestore(v.id)}
                    title="Restore this version"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>User ID: {v.created_by}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span title={formatLocalTimestamp(v.created_at)}>{formatDistanceToNow(parseServerTimestamp(v.created_at), { addSuffix: true })}</span>
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
