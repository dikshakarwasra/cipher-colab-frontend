import CodeEditor, { type LiveRange } from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VersionHistory from "@/components/VersionHistory";
import SecurityLogs from "@/components/SecurityLogs";
import {
  api,
  createWorkspaceSocket,
  getStoredUser,
  type ApiActivity,
  type ApiChatMessage,
  type ApiFile,
  type ApiJoinRequest,
  type ApiMember,
  type ApiNotification,
  type ApiWorkspace,
  type ApiVersion,
} from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { INTENT_CONFIGS, type Intent } from "@shared/intents";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Code2,
  FileCode,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Lock,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Smile,
  Sun,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { clearAuth } from "@/lib/api";
import { formatLocalTime, formatLocalTimestamp, parseServerTimestamp } from "@/lib/time";

type ConnectionState = "connected" | "reconnecting" | "offline";
type MemberStatus = "online" | "editing" | "reviewing" | "testing" | "offline";
type MsgTab = "general" | "thread" | "mentions";

interface MemberWithStatus extends ApiMember {
  status: MemberStatus;
  editingFile?: string;
  currentIntent?: Intent;
  currentIntentUpdatedAt?: string | number;
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

function getActivityDescription(item: ApiActivity) {
  const intentLabel = item.intent ? INTENT_CONFIGS[item.intent as Intent]?.label : null;
  switch (item.action) {
    case "changed_intent":
      return `changed intent${intentLabel ? ` to ${intentLabel}` : ""}`;
    case "sent_chat_message":
    case "chat_message":
      return "sent a chat message";
    case "saved_file":
    case "file_updated":
      return "saved a file";
    case "edited_file":
      return "edited a file";
    case "joined_workspace":
      return "joined the workspace";
    case "left_workspace":
      return "left the workspace";
    case "workspace_frozen":
      return "froze editing";
    case "workspace_unfrozen":
      return "unfroze editing";
    case "file_locked":
      return "locked a file";
    case "file_unlocked":
      return "unlocked a file";
    default:
      return item.action.replaceAll("_", " ");
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

const INTENT_BADGE: Record<string, string> = {
  debugging: "DBG",
  feature_development: "FEAT",
  refactoring: "REF",
  documentation: "DOC",
  testing: "TEST",
};

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python", js: "javascript", ts: "typescript", tsx: "typescript",
    jsx: "javascript", html: "html", css: "css", scss: "scss",
    json: "json", md: "markdown", txt: "plaintext", sh: "bash",
    go: "go", rs: "rust", java: "java", rb: "ruby", php: "php",
    c: "c", cpp: "cpp", yml: "yaml", yaml: "yaml", xml: "xml",
    dockerfile: "dockerfile", toml: "toml", env: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

export default function EnhancedWorkspace() {
  const [, navigate] = useLocation();
  const [workspaceId] = useState(queryWorkspaceId);
  const [currentUser] = useState(getStoredUser);
  const { theme, toggleTheme } = useTheme();

  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [joinRequests, setJoinRequests] = useState<ApiJoinRequest[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("reconnecting");
  const [latency, setLatency] = useState<number>(0);
  const [chatDraft, setChatDraft] = useState("");
  const [msgTab, setMsgTab] = useState<MsgTab>("general");
  const [msgCollapsed, setMsgCollapsed] = useState(false);
  const [newFileName, setNewFileName] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 1024);
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1024);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const [intent, setIntent] = useState<Intent | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const knownActivityIds = useRef<Set<string>>(new Set());
  const [showMoreMembers, setShowMoreMembers] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showSecurityLogs, setShowSecurityLogs] = useState(false);

  const isValidIntent = useCallback((value: unknown): value is Intent => {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(INTENT_CONFIGS, value);
  }, []);

  const addActivityItem = useCallback((item: ApiActivity) => {
    if (knownActivityIds.current.has(item.id)) return;
    knownActivityIds.current.add(item.id);
    setActivity((prev) =>
      [item, ...prev].sort((a, b) => parseServerTimestamp(b.created_at).getTime() - parseServerTimestamp(a.created_at).getTime())
    );
  }, []);

  const mergeActivityItems = useCallback((items: ApiActivity[]) => {
    setActivity((prev) => {
      const merged = new Map<string, ApiActivity>();
      for (const item of prev) merged.set(item.id, item);
      for (const item of items) merged.set(item.id, item);
      knownActivityIds.current = new Set(merged.keys());
      return Array.from(merged.values()).sort(
        (a, b) => parseServerTimestamp(b.created_at).getTime() - parseServerTimestamp(a.created_at).getTime()
      );
    });
  }, []);

  const addChatMessage = useCallback((message: ApiChatMessage) => {
    setMessages((prev) => (prev.some((existing) => existing.id === message.id) ? prev : [...prev, message]));
  }, []);

  const buildClientActivity = useCallback((params: {
    action: string;
    intent?: Intent | null;
    file_id?: string | null;
    details?: string | null;
  }): ApiActivity => ({
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspace_id: workspaceId,
    user_id: currentUser?.id ?? null,
    action: params.action,
    intent: params.intent ?? null,
    file_id: params.file_id ?? null,
    details: params.details ?? null,
    created_at: new Date().toISOString(),
  }), [currentUser?.id, workspaceId]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimeRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const rangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editActivityRef = useRef<Record<string, number>>({});
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInitRef = useRef(false);

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

  const showIntentChangeToast = useCallback((userName: string, nextIntent: Intent, changedAt: string | number | Date) => {
    const config = INTENT_CONFIGS[nextIntent];
    toast.custom(() => (
      <div className="glass-panel min-w-[260px] rounded-lg px-4 py-3 text-[#F8FAFC] shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]" style={{ background: config.color, color: config.color }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="text-xs text-[#94A3B8]">Switched to {config.label}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[#67E8F9]">
              <Clock className="h-3 w-3" />
              {formatLocalTimestamp(changedAt)}
            </p>
          </div>
        </div>
      </div>
    ));
  }, []);

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
    const membersWithStatus = memberData.map((m) => ({
      ...m,
      status: "online" as MemberStatus,
      currentIntent: m.user_id === currentUser?.id ? undefined : isValidIntent((m as any).currentIntent) ? (m as any).currentIntent : undefined,
      currentIntentUpdatedAt: (m as any).currentIntentUpdatedAt ?? (m as any).currentIntent_updated_at ?? undefined,
    }));
    setMembers(membersWithStatus);
    setMessages(chatData);
    mergeActivityItems(activityData);
    setNotifications(notifData);

    setIntent(null);

    if (fileData.length > 0) {
      const initialIds = fileData.slice(0, 4).map((f) => f.id);
      setOpenTabs(initialIds);
      setActiveTabId((cur) => cur || initialIds[0]);
    }
    const tree = buildFileTree(fileData);
    const topFolders = tree.filter((n) => n.type === "folder").map((n) => n.path);
    setOpenFolders(new Set(topFolders));
    // Load join requests if current user is admin
    if (currentUser) {
      const myMember = memberData.find((m) => m.user_id === currentUser.id);
      if (myMember?.role === "admin") {
        api.getJoinRequests(workspaceId).then(setJoinRequests).catch(() => {});
      }
    }
  }, [workspaceId, currentUser, isValidIntent, mergeActivityItems]);

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
            case "presence_sync":
              if (payload.online_user_ids) {
                const onlineIds = new Set(payload.online_user_ids);
                setMembers((prev) => prev.map((m) => ({
                  ...m,
                  status: onlineIds.has(m.user_id) ? "online" : "offline"
                })));
              }
              break;
            case "chat_message": {
              const message = payload.message ?? (payload.id ? payload : null);
              if (message) {
                addChatMessage(message);
              }
              if (payload.activity) {
                addActivityItem(payload.activity);
              } else if (message) {
                addActivityItem({
                  id: `remote-chat-${message.id}`,
                  workspace_id: workspaceId,
                  user_id: message.user_id,
                  action: "sent_chat_message",
                  intent: message.intent ?? null,
                  file_id: null,
                  details: message.content,
                  created_at: message.created_at,
                });
              }
              break;
            }
            case "file_updated":
              if (payload.fileId && typeof payload.content === "string") {
                setFiles((prev) => prev.map((f) => f.id === payload.fileId ? { ...f, content: payload.content } : f));
              }
              if (payload.activity) addActivityItem(payload.activity);
              break;
            case "file_saved":
              toast.info(`${payload.user?.displayName ?? "Someone"} saved a file`);
              if (payload.activity) {
                addActivityItem(payload.activity);
              } else {
                addActivityItem({
                  id: `remote-save-${payload.fileId}-${payload.changedAt ?? Date.now()}`,
                  workspace_id: workspaceId,
                  user_id: payload.user?.id ?? null,
                  action: "saved_file",
                  intent: payload.intent ?? null,
                  file_id: payload.fileId ?? null,
                  details: payload.summary ?? null,
                  created_at: payload.changedAt ?? new Date().toISOString(),
                });
              }
              break;
            case "workspace_frozen":
            case "workspace_unfrozen":
              if (typeof payload.frozen === "boolean") {
                setWorkspace((prev) => prev ? { ...prev, is_frozen: payload.frozen } : prev);
              }
              if (payload.activity) addActivityItem(payload.activity);
              break;
            case "intent_change": {
              if (!isValidIntent(payload.intent)) break;
              const changedAt = payload.changedAt ?? payload.createdAt ?? Date.now();
              const userName = payload.user?.displayName ?? payload.user?.username ?? "Someone";
              const userId = payload.userId ?? payload.user?.id;
              showIntentChangeToast(userName, payload.intent, changedAt);
              if (userId) {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.user_id === userId ? { ...m, currentIntent: payload.intent, currentIntentUpdatedAt: payload.changedAt ?? Date.now(), status: "editing" } : m
                  )
                );
              }
              if (payload.activity) {
                addActivityItem(payload.activity);
              } else {
                addActivityItem({
                  id: `remote-intent-${userId}-${payload.intent}-${changedAt}`,
                  workspace_id: workspaceId,
                  user_id: userId ?? null,
                  action: "changed_intent",
                  intent: payload.intent ?? null,
                  file_id: null,
                  details: `${userName} switched intent to ${INTENT_CONFIGS[payload.intent]?.label ?? payload.intent}`,
                  created_at: new Date(changedAt).toISOString(),
                });
              }
              break;
            }
            case "yjs_update":
              if (payload.fileId && typeof payload.content === "string") {
                setFiles((prev) => prev.map((f) => f.id === payload.fileId ? { ...f, content: payload.content } : f));
              }
              if (payload.activity) {
                addActivityItem(payload.activity);
              }
              {
                const userId = payload.userId ?? payload.user?.id;
                if (userId) {
                setMembers((prev) =>
                  prev.map((m) =>
                    m.user_id === userId ? { ...m, status: "editing", editingFile: payload.fileId } : m
                  )
                );
                }
              }
              break;
            case "member_joined":
            case "user_joined": {
              const joined = payload.member ?? payload.user;
              if (joined) {
                setMembers((prev) => {
                  const userId = joined.user_id ?? joined.id;
                  const exists = prev.find((m) => m.user_id === userId);
                  if (exists) return prev.map((m) => m.user_id === userId ? { ...m, status: "online", currentIntent: undefined } : m);
                  return [...prev, {
                    user_id: userId,
                    username: joined.username,
                    display_name: joined.displayName ?? joined.display_name ?? joined.username,
                    role: joined.role ?? "viewer",
                    muted_chat: false,
                    status: "online",
                  }];
                });
                addActivityItem({
                  id: `remote-join-${joined.user_id ?? joined.id}-${Date.now()}`,
                  workspace_id: workspaceId,
                  user_id: joined.user_id ?? joined.id,
                  action: "joined_workspace",
                  intent: null,
                  file_id: null,
                  details: null,
                  created_at: new Date().toISOString(),
                });
              }
              break;
            }
            case "member_left":
            case "user_left": {
              const userId = payload.userId ?? payload.user?.id;
              if (userId) {
                setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, status: "offline", currentIntent: undefined } : m));
                addActivityItem({
                  id: `remote-left-${userId}-${Date.now()}`,
                  workspace_id: workspaceId,
                  user_id: userId,
                  action: "left_workspace",
                  intent: null,
                  file_id: null,
                  details: null,
                  created_at: new Date().toISOString(),
                });
              }
              break;
            }
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
              if (payload.item) addActivityItem(payload.item);
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
      api.activity(workspaceId).then(mergeActivityItems).catch(() => {});
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
  }, [workspaceId, showIntentChangeToast, addActivityItem, addChatMessage, isValidIntent, mergeActivityItems]);

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

  // On mobile: auto-show the file explorer once when files first load
  useEffect(() => {
    if (!mobileInitRef.current && files.length > 0 && window.innerWidth < 1024) {
      setLeftOpen(true);
      mobileInitRef.current = true;
    }
  }, [files.length]);

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

  const handleContentChange = (content: string, _intent: Intent | null) => {
    if (!selectedFile) return;
    setFiles((prev) => prev.map((f) => f.id === selectedFile.id ? { ...f, content } : f));
    setModifiedFiles((prev) => new Set([...prev, selectedFile.id]));
    const now = Date.now();
    const shouldSendActivity = now - (editActivityRef.current[selectedFile.id] ?? 0) > 5000;
    const activityItem = shouldSendActivity
      ? buildClientActivity({
          action: "edited_file",
          intent,
          file_id: selectedFile.id,
          details: selectedFile.name,
        })
      : null;
    if (activityItem) {
      editActivityRef.current[selectedFile.id] = now;
      addActivityItem(activityItem);
    }
    socketRef.current?.send(JSON.stringify({ type: "yjs_update", fileId: selectedFile.id, content, intent, activity: activityItem }));
  };

  const saveFile = async () => {
    if (!selectedFile || !workspace) return;
    try {
      const updated = await api.updateFile(workspace.id, selectedFile.id, {
        content: selectedFile.content,
        intent,
        line_start: 1,
        line_end: selectedFile.content.split("\n").length,
        summary: `${intent ? INTENT_CONFIGS[intent].label : "Neutral"} edit`,
      });
      setFiles((prev) => prev.map((f) => f.id === updated.id ? updated : f));
      setModifiedFiles((prev) => { const s = new Set(prev); s.delete(updated.id); return s; });
      const activityItem = buildClientActivity({
        action: "saved_file",
        intent,
        file_id: selectedFile.id,
        details: `${intent ? INTENT_CONFIGS[intent].label : "Neutral"} save`,
      });
      addActivityItem(activityItem);
      socketRef.current?.send(JSON.stringify({ type: "file_saved", fileId: updated.id, intent, activity: activityItem }));
      toast.success("Saved and versioned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const sendMessage = async () => {
    if (!workspace || !chatDraft.trim()) return;
    try {
      const message = await api.sendChat(workspace.id, { content: chatDraft, intent });
      addChatMessage(message);
      setChatDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  };

  const toggleFreezeEditing = async () => {
    if (!workspace) return;
    const frozen = !workspace.is_frozen;
    try {
      await api.freezeWorkspace(workspaceId, frozen);
      setWorkspace((prev) => prev ? { ...prev, is_frozen: frozen } : prev);
      const activityItem = buildClientActivity({
        action: frozen ? "workspace_frozen" : "workspace_unfrozen",
        intent,
        details: frozen ? "Editing frozen" : "Editing unfrozen",
      });
      addActivityItem(activityItem);
      socketRef.current?.send(JSON.stringify({
        type: frozen ? "workspace_frozen" : "workspace_unfrozen",
        frozen,
        intent,
        activity: activityItem,
      }));
      toast.success(frozen ? "Editing frozen" : "Editing unfrozen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update freeze state");
    }
  };

  const switchIntent = (next: Intent) => {
    const changedAt = new Date().toISOString();
    setIntent(next);
    if (currentUser) {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === currentUser.id ? { ...m, currentIntent: next, currentIntentUpdatedAt: changedAt, status: "editing" } : m
        )
      );
      showIntentChangeToast(currentUser.display_name || currentUser.username, next, changedAt);
    }
    const activityItem = buildClientActivity({
      action: "changed_intent",
      intent: next,
      details: `Switched to ${INTENT_CONFIGS[next].label}`,
    });
    addActivityItem(activityItem);
    socketRef.current?.send(JSON.stringify({ type: "intent_change", intent: next, changedAt, activity: activityItem }));
  };

  // Create a new blank file, prompt by name in the tab bar
  const createNewFile = async () => {
    if (newFileName === null || !newFileName.trim() || !workspace) return;
    const name = newFileName.trim();
    try {
      const file = await api.createFile(workspace.id, {
        name,
        path: name,
        language: detectLanguage(name),
        content: "",
      });
      setFiles((prev) => [...prev, file]);
      setOpenTabs((prev) => [...prev, file.id]);
      setActiveTabId(file.id);
      setNewFileName(null);
      toast.success(`Created ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create file");
    }
  };

  const approveJoin = async (requestId: string) => {
    if (!workspaceId) return;
    try {
      await api.approveJoinRequest(workspaceId, requestId);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      api.members(workspaceId).then((data) =>
        setMembers(data.map((m) => ({ ...m, status: "online" as MemberStatus })))
      ).catch(() => {});
      toast.success("Member approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const rejectJoin = async (requestId: string) => {
    if (!workspaceId) return;
    try {
      await api.rejectJoinRequest(workspaceId, requestId);
      setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Request rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  // Broadcast the line the current user is editing (debounced 150ms)
  const handleRangeChange = useCallback((line: number, editIntent: Intent | null) => {
    if (!editIntent) return;
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
  const intentCounts = useMemo(() => {
    return activity.reduce<Record<string, number>>((counts, item) => {
      if (item.intent && isValidIntent(item.intent)) {
        counts[item.intent] = (counts[item.intent] ?? 0) + 1;
      }
      return counts;
    }, {});
  }, [activity, isValidIntent]);

  const handleInvite = async () => {
    if (!workspaceId || !inviteUsername.trim()) return;
    try {
      await api.inviteUser(workspaceId, inviteUsername.trim(), "editor");
      toast.success(`Invited ${inviteUsername}`);
      setInviteUsername("");
      setShowInvite(false);
      loadWorkspace();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    }
  };

  const codeChanges = useMemo(
    () =>
      activity
        .filter((a) => a.intent && selectedFile && a.file_id === selectedFile.id && ["file_updated", "saved_file"].includes(a.action))
        .map((a) => ({
          id: a.id,
          userId: String(a.user_id ?? "system"),
          username: "Collaborator",
          timestamp: parseServerTimestamp(a.created_at).getTime(),
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
    <main className="cipher-ambient flex h-screen flex-col overflow-hidden bg-[#0F172A] text-[#F8FAFC]">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-[#111827]/85 px-3 py-2 shrink-0 backdrop-blur-xl">
        {/* Left: logo + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setLeftOpen((v) => !v)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-6 w-6 rounded bg-[#38BDF8] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#38BDF8]/25">
              <Code2 className="h-3.5 w-3.5 text-[#0F172A]" />
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
          {/* Notification bell */}
          <div className="relative">
            <button
              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="h-4 w-4" />
              {(unread + joinRequests.length) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  {unread + joinRequests.length}
                </span>
              )}
            </button>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={() => { setShowSecurityLogs(v => !v); setShowVersions(false); setRightOpen(true); }}
            className={`rounded p-1.5 transition-colors ${showSecurityLogs ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
            title="Security Audit"
          >
            <Shield className="h-4 w-4" />
          </button>
          {/* Team panel toggle */}
          <button
            onClick={() => setRightOpen((v) => !v)}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Team panel"
          >
            <Users className="h-4 w-4" />
          </button>
          {currentUser && <Avatar name={currentUser.display_name || currentUser.username} size={26} />}
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
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">

        {/* ── LEFT PANE: Explorer ─────────────────────────────── */}
        {/* Mobile overlay backdrop */}
        {leftOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setLeftOpen(false)} />}
        <aside
          className={[
            "glass-panel flex flex-col shrink-0 border-r border-white/10 overflow-hidden",
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
              <button
                className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setNewFileName("")}
                title="New file"
              >
                <FilePlus2 className="h-3 w-3" />
              </button>
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

            {/* Expanded Content: Versions or Security Logs */}
            {showVersions && selectedFile && (
              <div className="flex-1 min-w-0 h-full border-l border-border">
                <VersionHistory
                  workspaceId={workspaceId}
                  fileId={selectedFile.id}
                  onRestore={(updated) => {
                    setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
                    setShowVersions(false);
                  }}
                />
              </div>
            )}

            {showSecurityLogs && (
              <div className="flex-1 min-w-0 h-full border-l border-border">
                <SecurityLogs />
              </div>
            )}
        </aside>

        {/* ── CENTER PANE ─────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Collaboration Intents Bar */}
          <div className="flex min-w-0 items-center gap-3 border-b border-white/10 bg-[rgba(17,24,39,0.75)] px-4 py-2 shrink-0 backdrop-blur-xl">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Collaboration Intents
            </span>
            <div className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1">
              {Object.entries(INTENT_CONFIGS).map(([key, cfg]) => {
                const count = intentCounts[key] ?? 0;
                const isActive = intent === key;
                return (
                  <button
                    key={key}
                    onClick={() => switchIntent(key as Intent)}
                    data-active={isActive}
                    className={`intent-card flex h-9 min-w-[144px] shrink-0 snap-start items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap transition sm:min-w-[170px] ${isActive ? "text-white shadow-[0_0_24px_rgba(56,189,248,.22)]" : "text-[#94A3B8] hover:text-[#F8FAFC]"}`}
                    style={{ borderColor: isActive ? cfg.borderColor : "rgba(148,163,184,0.18)", background: isActive ? cfg.bgColor : "rgba(15,23,42,0.48)" }}
                  >
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px]" style={{ color: cfg.color }}>{INTENT_BADGE[key]}</span>
                    <span className="min-w-0 truncate font-medium">{cfg.label.replace(" Development", " Dev")}</span>
                    <span className="shrink-0 opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <button className="hidden shrink-0 items-center gap-1 text-[10px] text-primary hover:underline whitespace-nowrap sm:flex">
              View all intents <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* File Tabs */}
          <div className="flex items-center border-b border-white/10 bg-[rgba(17,24,39,0.75)] shrink-0 backdrop-blur-xl">
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
                    className={`flex items-center gap-1.5 border-r border-white/10 px-3 py-2 text-xs cursor-pointer select-none whitespace-nowrap ${isActive ? "bg-[#0B1220] text-[#F8FAFC] border-b-2 border-b-[#38BDF8]" : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"}`}
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
              {newFileName !== null ? (
                <div className="flex items-center gap-1 border-r border-border px-2 py-1.5">
                  <input
                    ref={newFileInputRef}
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createNewFile();
                      if (e.key === "Escape") setNewFileName(null);
                    }}
                    placeholder="filename.py"
                    className="w-28 bg-background text-xs text-foreground border border-primary rounded px-1.5 py-0.5 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={createNewFile} className="text-green-400 hover:text-green-300">
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setNewFileName(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1 border-r border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  onClick={() => setNewFileName("")}
                  title="New file"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-3">
              {workspace && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs px-2.5"
                  onClick={toggleFreezeEditing}
                >
                  <Lock className="h-3 w-3" />
                  {workspace.is_frozen ? "Unfreeze" : "Freeze Editing"}
                </Button>
              )}
              <Button size="sm" className="h-7 gap-1.5 text-xs px-2.5" onClick={saveFile}>
                <Save className="h-3 w-3" /> Save
              </Button>
              <button
                onClick={() => { setShowVersions(v => !v); setShowSecurityLogs(false); setRightOpen(true); }}
                className={`rounded p-1 transition-colors ${showVersions ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                title="Version History"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {selectedFile ? (
              <CodeEditor
                content={selectedFile.content}
                fileName={selectedFile.path}
                language={selectedFile.language}
                currentIntent={intent}
                changes={codeChanges}
                onContentChange={handleContentChange}
                liveRanges={liveRanges}
                onRangeChange={handleRangeChange}
                compact
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <FilePlus2 className="h-10 w-10 opacity-30" />
                <p className="text-sm">No file open</p>
                <p className="text-xs opacity-60">
                  {window.innerWidth < 1024
                    ? "Tap ☰ to open the file explorer"
                    : "Select a file from the explorer or create a new one"}
                </p>
                <button
                  className="mt-1 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  onClick={() => setNewFileName("")}
                >
                  <Plus className="h-3 w-3" /> New file
                </button>
              </div>
            )}
          </div>

          {/* Messaging Section */}
          <div className={`shrink-0 flex flex-col border-t border-border bg-card transition-all ${msgCollapsed ? "h-9" : "h-[200px] sm:h-[220px]"}`}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Messaging</span>
              <button
                onClick={() => setMsgCollapsed((v) => !v)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title={msgCollapsed ? "Expand chat" : "Collapse chat"}
              >
                {msgCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
            {!msgCollapsed && (
              <>
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
                  {messages.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No messages yet. Say hi!</p>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-2">
                      <Avatar name={msg.username} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-semibold">{msg.username}</span>
                          <span className="text-[10px] text-muted-foreground">{formatLocalTime(msg.created_at)}</span>
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
                  <Button size="sm" className="h-7 w-7 p-0" onClick={sendMessage} disabled={!chatDraft.trim()}>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── RIGHT PANE: Team + Activity ─────────────────────── */}
        {/* Mobile overlay backdrop */}
        {rightOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setRightOpen(false)} />}
        <aside
          className={[
            "glass-panel flex flex-col shrink-0 border-l border-white/10 overflow-hidden transition-all",
            "fixed inset-y-0 right-0 z-50 transition-transform",
            rightOpen ? "translate-x-0" : "translate-x-full",
            "lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]",
            rightOpen ? (showVersions || showSecurityLogs ? "lg:w-[600px]" : "lg:w-72") : "lg:w-0",
          ].join(" ")}
          style={{ top: 45 }}
        >
          <div className="flex h-full">
            {/* Standard Right Pane (Team & Activity) */}
            <div className="flex flex-col w-72 shrink-0 border-r border-border h-full overflow-hidden">
              {/* Join Requests (admin only) */}
              {joinRequests.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-2.5 shrink-0">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex-1">Join Requests ({joinRequests.length})</span>
              </div>
              <div className="border-b border-border shrink-0">
                {joinRequests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/20">
                    <Avatar name={r.display_name} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{r.display_name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">Wants to join as {r.requested_role}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => approveJoin(r.id)}
                        className="flex items-center gap-0.5 rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400 hover:bg-green-500/40"
                      >
                        <Check className="h-2.5 w-2.5" /> Approve
                      </button>
                      <button
                        onClick={() => rejectJoin(r.id)}
                        className="rounded bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/20"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Team Members */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Team Members</span>
            <button
              onClick={() => setShowInvite(v => !v)}
              className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Invite
            </button>
          </div>

          {showInvite && (
            <div className="p-3 bg-secondary/20 border-b border-border space-y-2">
              <Input
                size={1}
                className="h-7 text-xs"
                placeholder="Username to invite..."
                value={inviteUsername}
                onChange={e => setInviteUsername(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleInvite()}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-6 flex-1 text-[10px]" onClick={handleInvite}>Send Invite</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto border-b border-border">
            {visibleMembers.map((m) => {
              const isYou = currentUser && m.user_id === currentUser.id;
              const statusColor = getStatusColor(m.status);
              const editingFileName = m.editingFile
                ? files.find((f) => f.id === m.editingFile)?.name ?? m.editingFile
                : null;
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-secondary/30 group">
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
                      {m.currentIntent
                        ? `${INTENT_CONFIGS[m.currentIntent].label} - ${m.currentIntentUpdatedAt ? formatLocalTime(m.currentIntentUpdatedAt) : "just now"}`
                        : editingFileName ?? (m.editingFile ? "editing..." : m.username)}
                    </div>
                  </div>

                  {/* Admin Actions */}
                  {currentUser && members.find(m => m.user_id === currentUser.id)?.role === "admin" && !isYou && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => api.muteMember(workspaceId, m.user_id, !m.muted_chat).then(loadWorkspace)}
                        className={`p-1 rounded hover:bg-secondary ${m.muted_chat ? "text-destructive" : "text-muted-foreground"}`}
                        title={m.muted_chat ? "Unmute" : "Mute"}
                      >
                        <Smile className={`h-3 w-3 ${m.muted_chat ? "line-through" : ""}`} />
                      </button>
                      <button
                        onClick={() => api.removeMember(workspaceId, m.user_id).then(loadWorkspace)}
                        className="p-1 rounded hover:bg-secondary text-destructive"
                        title="Remove member"
                      >
                        <LogOut className="h-3 w-3" />
                      </button>
                    </div>
                  )}

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
                      <span className="text-muted-foreground">{getActivityDescription(item)}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatLocalTime(item.created_at)}
                      {item.intent && (
                        <span className="ml-1" style={{ color: INTENT_CONFIGS[item.intent as Intent]?.color }}>
                          · {INTENT_CONFIGS[item.intent as Intent]?.label}
                        </span>
                      )}
                    </p>
                  </div>

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
            </div>

            {/* Expanded Content: Versions or Security Logs */}
            {showVersions && selectedFile && (
              <div className="flex-1 min-w-0 h-full border-l border-border">
                <VersionHistory
                  workspaceId={workspaceId}
                  fileId={selectedFile.id}
                  onRestore={(updated) => {
                    setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
                    setShowVersions(false);
                  }}
                />
              </div>
            )}

            {showSecurityLogs && (
              <div className="flex-1 min-w-0 h-full border-l border-border">
                <SecurityLogs />
              </div>
            )}
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

      {notifOpen && (
        <>
          <div className="fixed inset-0 z-[1190] bg-transparent" onClick={() => setNotifOpen(false)} />
          <div
            className={[
              "fixed z-[1200] overflow-hidden rounded-xl border border-white/10 bg-[#0B1220]/95 text-[#F8FAFC]",
              "shadow-[0_28px_90px_rgba(0,0,0,0.65)] ring-1 ring-white/5 backdrop-blur-2xl",
              "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150",
              isMobile ? "left-4 right-4 top-[60px] max-h-[calc(100vh-5rem)]" : "right-4 top-[56px] w-80 max-w-[calc(100vw-2rem)]",
            ].join(" ")}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-xs font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                <button
                  className="text-[10px] font-medium text-[#67E8F9] hover:underline"
                  onClick={() => api.markAllNotificationsRead().then(loadWorkspace)}
                >
                  Mark all read
                </button>
                <button className="rounded px-1.5 py-0.5 text-[10px] text-[#94A3B8] hover:bg-white/10 hover:text-white" onClick={() => setNotifOpen(false)}>Close</button>
              </div>
            </div>
            {joinRequests.length > 0 && (
              <div className="border-b border-white/10 bg-[#38BDF8]/8 px-3 py-2">
                <p className="mb-1 text-xs font-semibold text-[#67E8F9]">{joinRequests.length} join request{joinRequests.length > 1 ? "s" : ""}</p>
                {joinRequests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-xs">{r.display_name} wants to join as {r.requested_role}</span>
                    <button onClick={() => approveJoin(r.id)} className="text-[10px] font-semibold text-green-400 hover:underline">Approve</button>
                    <button onClick={() => rejectJoin(r.id)} className="text-[10px] text-red-300 hover:underline">Reject</button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-h-[min(22rem,calc(100vh-10rem))] overflow-y-auto p-1">
              {notifications.length === 0 ? (
                <p className="px-3 py-4 text-xs text-[#94A3B8]">No notifications</p>
              ) : notifications.slice(0, 8).map((n) => (
                <div key={n.id} className={`rounded-lg px-3 py-2 ${!n.is_read ? "bg-[#38BDF8]/10" : "hover:bg-white/5"}`}>
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#94A3B8]">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

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

    </main>
  );
}
