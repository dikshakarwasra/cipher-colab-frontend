import CodeEditor, { type LiveRange } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  createWorkspaceSocket,
  getStoredUser,
  type ApiActivity,
  type ApiChatMessage,
  type ApiFile,
  type ApiMember,
  type ApiNotification,
  type ApiWorkspace,
} from "@/lib/api";
import { INTENT_CONFIGS, INTENTS, type Intent } from "@shared/intents";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Command,
  FileCode,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  HelpCircle,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Smile,
  Terminal,
  User,
  UserPlus,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { clearAuth } from "@/lib/api";

type ConnectionState = "connected" | "reconnecting" | "offline";
type MemberStatus = "online" | "editing" | "reviewing" | "testing" | "offline";
type MsgTab = "general" | "thread" | "mentions";

interface MemberWithStatus extends ApiMember {
  status: MemberStatus;
  editingFile?: string;
  currentIntent?: Intent;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeNode[];
  file?: ApiFile;
}

function queryWorkspaceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("workspace") ?? localStorage.getItem("cipher-collab-workspace-id") ?? "";
}

function buildFileTree(files: ApiFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  for (const file of files) {
    const parts = file.path.split("/");
    let level = root;
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      let folder = folderMap.get(currentPath);
      if (!folder) {
        folder = { name: parts[i], path: currentPath, type: "folder", children: [] };
        folderMap.set(currentPath, folder);
        level.push(folder);
      }
      level = folder.children!;
    }
    level.push({ name: parts[parts.length - 1], path: file.path, type: "file", file });
  }
  return root;
}

function getFileIcon(name: string) {
  if (name.endsWith(".py")) return <span className="text-[10px] font-bold text-yellow-400">PY</span>;
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return <span className="text-[10px] font-bold text-blue-400">TS</span>;
  if (name.endsWith(".js") || name.endsWith(".jsx")) return <span className="text-[10px] font-bold text-yellow-300">JS</span>;
  if (name.endsWith(".json")) return <FileJson className="h-3.5 w-3.5 text-yellow-500" />;
  if (name.endsWith(".md")) return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  if (name.endsWith(".txt")) return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  if (name.endsWith(".css") || name.endsWith(".scss")) return <span className="text-[10px] font-bold text-pink-400">CS</span>;
  if (name.endsWith(".html")) return <span className="text-[10px] font-bold text-orange-400">HT</span>;
  return <FileCode className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getAvatarColor(name: string) {
  const colors = ["#1976D2", "#E53935", "#9C27B0", "#2ECC71", "#FFB74D", "#00BCD4", "#FF5722", "#607D8B"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getStatusColor(status: MemberStatus) {
  switch (status) {
    case "online": return "#2ECC71";
    case "editing": return "#FFB74D";
    case "reviewing": return "#1976D2";
    case "testing": return "#9C27B0";
    case "offline": return "#6B7280";
  }
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, background: getAvatarColor(name), fontSize: size * 0.36 }}
    >
      {getInitials(name)}
    </div>
  );
}

function FileTreeView({
  nodes,
  selectedId,
  openFolders,
  modifiedIds,
  onToggleFolder,
  onSelectFile,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedId: string;
  openFolders: Set<string>;
  modifiedIds: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (file: ApiFile) => void;
  depth?: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isOpen = openFolders.has(node.path);
        if (node.type === "folder") {
          return (
            <div key={node.path}>
              <button
                onClick={() => onToggleFolder(node.path)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-[3px] text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                {isOpen ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                {isOpen ? <FolderOpen className="h-3.5 w-3.5 text-accent flex-shrink-0" /> : <Folder className="h-3.5 w-3.5 text-accent flex-shrink-0" />}
                <span className="truncate">{node.name}</span>
              </button>
              {isOpen && node.children && (
                <FileTreeView
                  nodes={node.children}
                  selectedId={selectedId}
                  openFolders={openFolders}
                  modifiedIds={modifiedIds}
                  onToggleFolder={onToggleFolder}
                  onSelectFile={onSelectFile}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }
        const file = node.file!;
        const isSelected = file.id === selectedId;
        const isModified = modifiedIds.has(file.id);
        return (
          <button
            key={node.path}
            onClick={() => onSelectFile(file)}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-[3px] text-sm ${isSelected ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            <span className="flex h-4 w-5 items-center justify-center flex-shrink-0">{getFileIcon(node.name)}</span>
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            {isModified && <span className="text-[10px] font-bold text-accent ml-auto">M</span>}
            {file.locked_by && <Lock className="h-2.5 w-2.5 text-destructive ml-auto" />}
          </button>
        );
      })}
    </>
  );
}

const INTENT_ICON: Record<string, string> = {
  debugging: "🐛",
  feature_development: "⭐",
  refactoring: "🔄",
  documentation: "📝",
  testing: "✅",
};

export default function EnhancedWorkspace() {
  const [, navigate] = useLocation();
  const [workspaceId] = useState(queryWorkspaceId);
  const currentUser = getStoredUser();

  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [intent, setIntent] = useState<Intent>(INTENTS.FEATURE_DEVELOPMENT);
  const [connection, setConnection] = useState<ConnectionState>("reconnecting");
  const [latency, setLatency] = useState<number>(0);
  const [chatDraft, setChatDraft] = useState("");
  const [msgTab, setMsgTab] = useState<MsgTab>("general");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showMoreMembers, setShowMoreMembers] = useState(false);
  const [intentCounts, setIntentCounts] = useState<Record<string, number>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimeRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const rangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // liveEdits tracks other collaborators' current editing position per userId
  const [liveEdits, setLiveEdits] = useState<Map<string, {
    intent: Intent;
    lineStart: number;
    lineEnd: number;
    username: string;
    fileId: string;
    updatedAt: number;
  }>>(new Map());

  const selectedFile = files.find((f) => f.id === activeTabId) ?? files[0];

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    const [workspaceData, fileData, memberData, chatData, activityData, notifData] = await Promise.all([
      api.getWorkspace(workspaceId),
      api.files(workspaceId),
      api.members(workspaceId),
      api.chat(workspaceId),
      api.activity(workspaceId),
      api.notifications(),
    ]);
    setWorkspace(workspaceData);
    setFiles(fileData);
    setMembers(memberData.map((m) => ({ ...m, status: "online" as MemberStatus })));
    setMessages(chatData);
    setActivity(activityData);
    setNotifications(notifData);
    if (fileData.length > 0) {
      const initialIds = fileData.slice(0, 4).map((f) => f.id);
      setOpenTabs(initialIds);
      setActiveTabId((cur) => cur || initialIds[0]);
    }
    const counts: Record<string, number> = {};
    activityData.forEach((a) => { if (a.intent) counts[a.intent] = (counts[a.intent] ?? 0) + 1; });
    setIntentCounts(counts);
    // Open first-level folders by default
    const tree = buildFileTree(fileData);
    const topFolders = tree.filter((n) => n.type === "folder").map((n) => n.path);
    setOpenFolders(new Set(topFolders));
  }, [workspaceId]);

  useEffect(() => {
    loadWorkspace().catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load workspace"));
  }, [loadWorkspace]);

  // WebSocket with real-time updates
  useEffect(() => {
    if (!workspaceId) return;
    const connect = () => {
      const socket = createWorkspaceSocket(workspaceId);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnection("connected");
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            pingTimeRef.current = Date.now();
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 15000);
      };

      socket.onclose = () => {
        setConnection("reconnecting");
        if (pingRef.current) clearInterval(pingRef.current);
        window.setTimeout(connect, 2000);
      };

      socket.onerror = () => setConnection("offline");

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          switch (payload.type) {
            case "pong":
              setLatency(Date.now() - pingTimeRef.current);
              break;
            case "chat_message":
              if (payload.message) setMessages((prev) => [...prev, payload.message]);
              break;
            case "file_saved":
              toast.info(`${payload.user?.displayName ?? "Someone"} saved a file`);
              if (payload.activity) setActivity((prev) => [payload.activity, ...prev]);
              break;
            case "intent_change":
              toast.info(`${payload.user?.displayName ?? "Someone"} switched to ${payload.intent}`);
              if (payload.userId) {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.user_id === payload.userId ? { ...m, currentIntent: payload.intent, status: "editing" } : m
                  )
                );
              }
              setIntentCounts((prev) => ({
                ...prev,
                [payload.intent]: (prev[payload.intent] ?? 0) + 1,
              }));
              break;
            case "yjs_update":
              if (payload.fileId && payload.content) {
                setFiles((prev) => prev.map((f) => f.id === payload.fileId ? { ...f, content: payload.content } : f));
              }
              if (payload.userId) {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.user_id === payload.userId ? { ...m, status: "editing", editingFile: payload.fileId } : m
                  )
                );
              }
              break;
            case "member_joined":
              if (payload.member) {
                setMembers((prev) => {
                  const exists = prev.find((m) => m.user_id === payload.member.user_id);
                  if (exists) return prev.map((m) => m.user_id === payload.member.user_id ? { ...m, status: "online" } : m);
                  return [...prev, { ...payload.member, status: "online" }];
                });
              }
              break;
            case "member_left":
              if (payload.userId) {
                setMembers((prev) => prev.map((m) => m.user_id === payload.userId ? { ...m, status: "offline" } : m));
              }
              break;
            case "presence_update":
              if (payload.userId && payload.status) {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.user_id === payload.userId ? { ...m, status: payload.status, editingFile: payload.fileId } : m
                  )
                );
              }
              break;
            case "intent_range":
              // Another collaborator is editing — show their intent highlight in the editor
              if (payload.user?.id && payload.fileId && payload.intent) {
                const senderId = String(payload.user.id);
                setLiveEdits((prev) => {
                  const next = new Map(prev);
                  next.set(senderId, {
                    intent: payload.intent as Intent,
                    lineStart: payload.lineStart ?? 1,
                    lineEnd: payload.lineEnd ?? 1,
                    username: payload.user?.displayName || payload.user?.username || "Someone",
                    fileId: payload.fileId,
                    updatedAt: Date.now(),
                  });
                  return next;
                });
              }
              break;
            case "activity":
              if (payload.item) setActivity((prev) => [payload.item, ...prev]);
              break;
            case "notification":
              if (payload.notification) setNotifications((prev) => [payload.notification, ...prev]);
              break;
          }
        } catch { /* ignore parse errors */ }
      };
    };
    connect();
    // Periodic refresh fallback
    const refreshInterval = setInterval(() => {
      api.notifications().then(setNotifications).catch(() => {});
      api.activity(workspaceId).then((data) => {
        setActivity(data);
        const counts: Record<string, number> = {};
        data.forEach((a) => { if (a.intent) counts[a.intent] = (counts[a.intent] ?? 0) + 1; });
        setIntentCounts(counts);
      }).catch(() => {});
      api.members(workspaceId).then((data) => {
        setMembers((prev) => data.map((m) => {
          const existing = prev.find((p) => p.user_id === m.user_id);
          return { ...m, status: existing?.status ?? "online", editingFile: existing?.editingFile, currentIntent: existing?.currentIntent };
        }));
      }).catch(() => {});
    }, 30000);

    return () => {
      socketRef.current?.close();
      if (pingRef.current) clearInterval(pingRef.current);
      clearInterval(refreshInterval);
    };
  }, [workspaceId]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Purge stale live-edit highlights older than 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setLiveEdits((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (now - v.updatedAt > 5000) { next.delete(k); changed = true; }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen(true); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveFile(); }
      if (e.key === "Escape") { setCommandOpen(false); setNotifOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFile, intent]);

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const openFile = (file: ApiFile) => {
    setActiveTabId(file.id);
    if (!openTabs.includes(file.id)) setOpenTabs((prev) => [...prev, file.id]);
  };

  const closeTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter((id) => id !== fileId);
    setOpenTabs(newTabs);
    if (activeTabId === fileId) setActiveTabId(newTabs[newTabs.length - 1] ?? "");
    setModifiedFiles((prev) => { const s = new Set(prev); s.delete(fileId); return s; });
  };

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const handleContentChange = (content: string, _intent: Intent) => {
    if (!selectedFile) return;
    setFiles((prev) => prev.map((f) => f.id === selectedFile.id ? { ...f, content } : f));
    setModifiedFiles((prev) => new Set([...prev, selectedFile.id]));
    socketRef.current?.send(JSON.stringify({ type: "yjs_update", fileId: selectedFile.id, content, intent }));
  };

  const saveFile = async () => {
    if (!selectedFile || !workspace) return;
    try {
      const updated = await api.updateFile(workspace.id, selectedFile.id, {
        content: selectedFile.content,
        intent,
        line_start: 1,
        line_end: selectedFile.content.split("\n").length,
        summary: `${INTENT_CONFIGS[intent].label} edit`,
      });
      setFiles((prev) => prev.map((f) => f.id === updated.id ? updated : f));
      setModifiedFiles((prev) => { const s = new Set(prev); s.delete(updated.id); return s; });
      socketRef.current?.send(JSON.stringify({ type: "file_saved", fileId: updated.id, intent }));
      toast.success("Saved and versioned");
      loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const sendMessage = async () => {
    if (!workspace || !chatDraft.trim()) return;
    try {
      const message = await api.sendChat(workspace.id, { content: chatDraft, intent });
      setMessages((prev) => [...prev, message]);
      socketRef.current?.send(JSON.stringify({ type: "chat_message", message }));
      setChatDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  };

  const switchIntent = (next: Intent) => {
    setIntent(next);
    socketRef.current?.send(JSON.stringify({ type: "intent_change", intent: next }));
  };

  // Broadcast the line the current user is editing (debounced 150ms)
  const handleRangeChange = useCallback((line: number, editIntent: Intent) => {
    if (rangeDebounceRef.current) clearTimeout(rangeDebounceRef.current);
    rangeDebounceRef.current = setTimeout(() => {
      if (selectedFile && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "intent_range",
          fileId: selectedFile.id,
          intent: editIntent,
          lineStart: line,
          lineEnd: line,
        }));
      }
    }, 150);
  }, [selectedFile]);

  // Collect live highlights from other collaborators for the currently open file
  const liveRanges = useMemo<LiveRange[]>(() => {
    if (!selectedFile) return [];
    return Array.from(liveEdits.values())
      .filter((e) => e.fileId === selectedFile.id)
      .map((e) => ({
        intent: e.intent,
        lineStart: e.lineStart,
        lineEnd: e.lineEnd,
        username: e.username,
      }));
  }, [liveEdits, selectedFile?.id]);

  const unread = notifications.filter((n) => !n.is_read).length;
  const visibleMembers = showMoreMembers ? members : members.slice(0, 5);
  const extraMembers = Math.max(0, members.length - 5);

  const codeChanges = useMemo(
    () =>
      activity
        .filter((a) => a.intent)
        .map((a) => ({
          id: a.id,
          userId: String(a.user_id ?? "system"),
          username: "Collaborator",
          timestamp: new Date(a.created_at).getTime(),
          intent: a.intent as Intent,
          lineStart: 1,
          lineEnd: selectedFile?.content.split("\n").length ?? 1,
          content: selectedFile?.content ?? "",
          previousContent: "",
        })),
    [activity, selectedFile]
  );

  if (!workspaceId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        No workspace selected.{" "}
        <button className="ml-2 text-primary underline" onClick={() => navigate("/role-room")}>Go back</button>
      </div>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
        {/* Left: logo + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setLeftOpen((v) => !v)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center flex-shrink-0">
              <Code2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm hidden sm:block">Cipher Collab</span>
          </div>
          <span className="text-muted-foreground hidden sm:block">/</span>
          <div className="flex items-center gap-1 min-w-0 hidden sm:flex">
            <button className="text-xs text-muted-foreground hover:text-foreground">Workspace</button>
            <span className="text-muted-foreground">/</span>
            <button className="flex items-center gap-1 text-xs font-medium hover:text-foreground truncate max-w-[120px]">
              {workspace?.name ?? "Cipher Workspace"}
              <ChevronDown className="h-3 w-3 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="gap-1.5 h-7 text-xs px-2.5 hidden sm:flex">
            <UserPlus className="h-3 w-3" /> Invite
          </Button>
          {/* Member avatars */}
          <div className="hidden md:flex items-center -space-x-1.5">
            {members.slice(0, 3).map((m) => (
              <Avatar key={m.user_id} name={m.display_name || m.username} size={24} />
            ))}
            {members.length > 3 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold border border-border">
                +{members.length - 3}
              </span>
            )}
          </div>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Search className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => { setNotifOpen((v) => !v); setRightOpen(true); }}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {/* Notification dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-8 z-50 w-72 rounded-lg border border-border bg-card shadow-xl" onClick={() => setNotifOpen(false)}>
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold">Notifications</span>
                  <button className="text-xs text-primary hover:underline">Mark all read</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No notifications</p>
                  ) : notifications.slice(0, 8).map((n) => (
                    <div key={n.id} className={`border-b border-border/50 px-3 py-2 ${!n.is_read ? "bg-primary/5" : ""}`}>
                      <p className="text-xs font-medium">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground">{n.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground hidden sm:block">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="hidden lg:flex rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Users className="h-4 w-4" />
          </button>
          {currentUser && (
            <div className="flex items-center gap-1">
              <Avatar name={currentUser.display_name || currentUser.username} size={26} />
            </div>
          )}
          <button
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={() => { clearAuth(); navigate("/"); }}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── LEFT PANE: Explorer ─────────────────────────────── */}
        {/* Mobile overlay backdrop */}
        {leftOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setLeftOpen(false)} />}
        <aside
          className={[
            "flex flex-col shrink-0 border-r border-border bg-card overflow-hidden",
            "fixed inset-y-0 left-0 z-50 w-52 transition-transform",
            leftOpen ? "translate-x-0" : "-translate-x-full",
            "lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]",
            leftOpen ? "lg:w-52" : "lg:w-0",
          ].join(" ")}
          style={{ top: 45 }}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Explorer</span>
            <div className="flex gap-0.5">
              <button className="rounded p-0.5 hover:bg-secondary text-muted-foreground"><FilePlus2 className="h-3 w-3" /></button>
              <button className="rounded p-0.5 hover:bg-secondary text-muted-foreground"><RefreshCw className="h-3 w-3" /></button>
              <button className="rounded p-0.5 hover:bg-secondary text-muted-foreground"><MoreHorizontal className="h-3 w-3" /></button>
            </div>
          </div>
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-foreground">
              <ChevronDown className="h-3 w-3" />
              {workspace?.name ?? "Workspace"}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            <FileTreeView
              nodes={fileTree}
              selectedId={activeTabId || selectedFile?.id || ""}
              openFolders={openFolders}
              modifiedIds={modifiedFiles}
              onToggleFolder={toggleFolder}
              onSelectFile={openFile}
            />
          </div>
          <div className="border-t border-border flex items-center gap-2 px-3 py-2">
            <button className="text-muted-foreground hover:text-foreground"><Users className="h-4 w-4" /></button>
            <button className="text-muted-foreground hover:text-foreground"><Settings className="h-4 w-4" /></button>
            <div className="ml-auto flex items-center gap-1 text-[10px]">
              <Circle
                className="h-2 w-2"
                style={{ fill: connection === "connected" ? "#2ECC71" : connection === "reconnecting" ? "#FFB74D" : "#E53935", color: "transparent" }}
              />
              <span className="text-muted-foreground">{connection === "connected" ? `${latency}ms` : connection}</span>
            </div>
          </div>
        </aside>

        {/* ── CENTER PANE ─────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Collaboration Intents Bar */}
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Collaboration Intents
            </span>
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
              {Object.entries(INTENT_CONFIGS).map(([key, cfg]) => {
                const count = intentCounts[key] ?? 0;
                const isActive = intent === key;
                return (
                  <button
                    key={key}
                    onClick={() => switchIntent(key as Intent)}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors ${isActive ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"}`}
                    style={isActive ? { background: cfg.color } : { background: cfg.bgColor }}
                  >
                    <span>{INTENT_ICON[key]}</span>
                    <span className="font-medium">{cfg.label.replace(" Development", " Dev")}</span>
                    <span className="ml-0.5 opacity-70">{count} Active</span>
                  </button>
                );
              })}
            </div>
            <button className="flex items-center gap-1 text-[10px] text-primary hover:underline whitespace-nowrap">
              View all intents <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* File Tabs */}
          <div className="flex items-center border-b border-border bg-card shrink-0">
            <div className="flex min-w-0 flex-1 overflow-x-auto">
              {openTabs.map((tabId) => {
                const file = files.find((f) => f.id === tabId);
                if (!file) return null;
                const isActive = tabId === activeTabId;
                const isModified = modifiedFiles.has(tabId);
                return (
                  <div
                    key={tabId}
                    onClick={() => setActiveTabId(tabId)}
                    className={`flex items-center gap-1.5 border-r border-border px-3 py-2 text-xs cursor-pointer select-none whitespace-nowrap ${isActive ? "bg-background text-foreground border-b-2 border-b-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"}`}
                  >
                    <span className="flex h-3.5 w-4 items-center justify-center">{getFileIcon(file.name)}</span>
                    <span>{file.name}</span>
                    {isModified && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    <button
                      onClick={(e) => closeTab(tabId, e)}
                      className="rounded p-0.5 opacity-50 hover:opacity-100 hover:bg-secondary"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
              <button
                className="flex items-center gap-1 border-r border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                onClick={() => {}}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 px-3">
              {workspace && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs px-2.5"
                  onClick={() => api.freezeWorkspace(workspaceId, !workspace.is_frozen).then(loadWorkspace)}
                >
                  <Lock className="h-3 w-3" />
                  {workspace.is_frozen ? "Unfreeze" : "Freeze Editing"}
                </Button>
              )}
              <Button size="sm" className="h-7 gap-1.5 text-xs px-2.5" onClick={saveFile}>
                <Save className="h-3 w-3" /> Save
              </Button>
              <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeEditor
              content={selectedFile?.content ?? ""}
              fileName={selectedFile?.path ?? "No file"}
              language={selectedFile?.language ?? "typescript"}
              currentIntent={intent}
              changes={codeChanges}
              onContentChange={handleContentChange}
              liveRanges={liveRanges}
              onRangeChange={handleRangeChange}
              compact
            />
          </div>

          {/* Messaging Section */}
          <div className="flex h-[220px] shrink-0 flex-col border-t border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Messaging</span>
              <div className="flex items-center gap-1">
                <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Phone className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Video className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><Users className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><MoreHorizontal className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border text-xs">
              {(["general", "thread", "mentions"] as MsgTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMsgTab(tab)}
                  className={`px-4 py-2 capitalize transition-colors ${msgTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2">
                  <Avatar name={msg.username} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold">{msg.username}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {msg.intent && (
                        <span className="rounded px-1 text-[9px]" style={{ background: INTENT_CONFIGS[msg.intent]?.bgColor, color: INTENT_CONFIGS[msg.intent]?.color }}>
                          {INTENT_CONFIGS[msg.intent]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <Input
                className="h-7 flex-1 text-xs"
                placeholder="Type a message..."
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button className="text-muted-foreground hover:text-foreground"><Smile className="h-4 w-4" /></button>
              <button className="text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /></button>
              <Button size="sm" className="h-7 w-7 p-0" onClick={sendMessage} disabled={!chatDraft.trim()}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
              </Button>
            </div>
          </div>
        </section>

        {/* ── RIGHT PANE: Team + Activity ─────────────────────── */}
        {/* Mobile overlay backdrop */}
        {rightOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setRightOpen(false)} />}
        <aside
          className={[
            "flex flex-col shrink-0 border-l border-border bg-card overflow-hidden",
            "fixed inset-y-0 right-0 z-50 w-72 transition-transform",
            rightOpen ? "translate-x-0" : "translate-x-full",
            "lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]",
            rightOpen ? "lg:w-72" : "lg:w-0",
          ].join(" ")}
          style={{ top: 45 }}
        >
          {/* Team Members */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Team Members</span>
            <button className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline">
              <Plus className="h-3 w-3" /> Invite
            </button>
          </div>
          <div className="overflow-y-auto border-b border-border">
            {visibleMembers.map((m) => {
              const isYou = currentUser && m.user_id === currentUser.id;
              const statusColor = getStatusColor(m.status);
              const editingFileName = m.editingFile
                ? files.find((f) => f.id === m.editingFile)?.name ?? m.editingFile
                : null;
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-secondary/30">
                  <div className="relative flex-shrink-0">
                    <Avatar name={m.display_name || m.username} size={32} />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card"
                      style={{ background: statusColor }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      {m.display_name || m.username}
                      {isYou && <span className="text-[10px] text-muted-foreground">(You)</span>}
                      {m.role === "admin" && <span className="text-accent text-[11px]">👑</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {editingFileName ?? (m.editingFile ? "editing..." : m.username)}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-medium capitalize flex-shrink-0"
                    style={{ color: statusColor }}
                  >
                    {m.status}
                  </span>
                </div>
              );
            })}
            {extraMembers > 0 && !showMoreMembers && (
              <button
                className="w-full px-4 py-2 text-[11px] text-primary hover:underline text-left"
                onClick={() => setShowMoreMembers(true)}
              >
                + {extraMembers} more member{extraMembers > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Recent Activity */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Activity</span>
            <button className="text-[10px] font-medium text-primary hover:underline">View all</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activity.slice(0, 12).map((item) => {
              const userName = item.user_id
                ? members.find((m) => m.user_id === item.user_id)?.display_name ??
                  members.find((m) => m.user_id === item.user_id)?.username ??
                  "Someone"
                : "System";
              return (
                <div key={item.id} className="flex items-start gap-2 border-b border-border/50 px-4 py-2.5 hover:bg-secondary/20">
                  <Avatar name={userName} size={24} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-snug">
                      <span className="font-semibold">{userName}</span>{" "}
                      <span className="text-muted-foreground">{item.action.replaceAll("_", " ")}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {item.intent && (
                        <span className="ml-1" style={{ color: INTENT_CONFIGS[item.intent as Intent]?.color }}>
                          · {INTENT_CONFIGS[item.intent as Intent]?.label}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] flex-shrink-0"
                    onClick={() => toast.info("Restore not yet implemented")}
                  >
                    Restore
                  </Button>
                </div>
              );
            })}
            {activity.length === 0 && (
              <p className="px-4 py-4 text-xs text-muted-foreground">No activity yet.</p>
            )}
          </div>

          {/* Connection footer */}
          <div className="border-t border-border px-4 py-2 shrink-0 flex items-center gap-2">
            {connection === "connected"
              ? <Wifi className="h-3 w-3 text-green-400" />
              : <WifiOff className="h-3 w-3 text-muted-foreground" />
            }
            <span className="text-[10px] text-muted-foreground capitalize">{connection}</span>
            {latency > 0 && connection === "connected" && (
              <span className="ml-auto text-[10px] text-muted-foreground">{latency}ms</span>
            )}
            <button
              className="ml-auto text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setRightOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile FABs */}
      <div className="fixed bottom-4 left-4 flex gap-2 lg:hidden z-30">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground"
          onClick={() => { setLeftOpen(true); setRightOpen(false); }}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      <div className="fixed bottom-4 right-4 flex gap-2 lg:hidden z-30">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg text-white"
          onClick={() => { setRightOpen(true); setLeftOpen(false); }}
        >
          <Users className="h-4 w-4" />
        </button>
      </div>

      {/* Command Palette */}
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur" onClick={() => setCommandOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Input autoFocus placeholder="Search files, commands, users..." className="mb-3" />
            <div className="space-y-1">
              {["Save file (Ctrl+S)", "Freeze editing", "Switch intent", "Invite user", "Open activity", "View analytics", "Settings"].map((cmd) => (
                <button
                  key={cmd}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-secondary"
                  onClick={() => {
                    if (cmd === "Save file (Ctrl+S)") saveFile();
                    if (cmd === "Open activity") setRightOpen(true);
                    setCommandOpen(false);
                  }}
                >
                  {cmd}<ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close notification dropdown */}
      {notifOpen && <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />}
    </main>
  );
}
