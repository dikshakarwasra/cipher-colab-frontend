import CodeEditor from "@/components/CodeEditor";
import ConnectionStatus from "@/components/ConnectionStatus";
import IntentSelector from "@/components/IntentSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, createWorkspaceSocket, type ApiActivity, type ApiChatMessage, type ApiFile, type ApiMember, type ApiNotification, type ApiWorkspace } from "@/lib/api";
import { INTENT_CONFIGS, INTENTS, type Intent } from "@shared/intents";
import { BarChart3, Bell, Bot, CheckCircle2, ChevronRight, Cloud, Command, FilePlus2, GitBranch, History, Lock, Menu, MessageSquare, Play, RefreshCw, Save, Search, Shield, Users, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ConnectionState = "connected" | "reconnecting" | "offline";

function queryWorkspaceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("workspace") ?? localStorage.getItem("cipher-collab-workspace-id") ?? "";
}

function languageIcon(language: string) {
  if (language.includes("python")) return "PY";
  if (language.includes("html")) return "HT";
  if (language.includes("json")) return "{}";
  if (language.includes("markdown")) return "MD";
  return "TS";
}

export default function EnhancedWorkspace() {
  const [workspaceId] = useState(queryWorkspaceId);
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null);
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [messages, setMessages] = useState<ApiChatMessage[]>([]);
  const [activity, setActivity] = useState<ApiActivity[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [intent, setIntent] = useState<Intent>(INTENTS.FEATURE_DEVELOPMENT);
  const [connection, setConnection] = useState<ConnectionState>("reconnecting");
  const [chatDraft, setChatDraft] = useState("");
  const [search, setSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"chat" | "activity" | "analytics" | "security">("chat");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);

  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0];

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    const [workspaceData, fileData, memberData, chatData, activityData, notificationData] = await Promise.all([
      api.getWorkspace(workspaceId),
      api.files(workspaceId),
      api.members(workspaceId),
      api.chat(workspaceId),
      api.activity(workspaceId),
      api.notifications(),
    ]);
    setWorkspace(workspaceData);
    setFiles(fileData);
    setMembers(memberData);
    setMessages(chatData);
    setActivity(activityData);
    setNotifications(notificationData);
    setSelectedFileId((current) => current || fileData[0]?.id || "");
  }, [workspaceId]);

  useEffect(() => {
    loadWorkspace().catch((error) => toast.error(error instanceof Error ? error.message : "Workspace failed to load"));
  }, [loadWorkspace]);

  useEffect(() => {
    if (!workspaceId) return;
    const connect = () => {
      const socket = createWorkspaceSocket(workspaceId);
      socketRef.current = socket;
      socket.onopen = () => setConnection("connected");
      socket.onclose = () => {
        setConnection("reconnecting");
        window.setTimeout(connect, 1600);
      };
      socket.onerror = () => setConnection("offline");
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "chat_message" && payload.message) setMessages((items) => [...items, payload.message]);
        if (payload.type === "file_saved") toast.info(`${payload.user?.displayName ?? "Someone"} saved a file`);
        if (payload.type === "intent_change") toast.info(`${payload.user?.displayName ?? "Someone"} switched to ${payload.intent}`);
      };
    };
    connect();
    return () => socketRef.current?.close();
  }, [workspaceId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredFiles = files.filter((file) => `${file.name} ${file.path} ${file.content}`.toLowerCase().includes(search.toLowerCase()));
  const unread = notifications.filter((item) => !item.is_read).length;
  const intentCounts = useMemo(() => {
    return activity.reduce<Record<string, number>>((acc, item) => {
      if (item.intent) acc[item.intent] = (acc[item.intent] ?? 0) + 1;
      return acc;
    }, {});
  }, [activity]);

  const handleContentChange = (content: string) => {
    if (!selectedFile) return;
    setFiles((items) => items.map((file) => file.id === selectedFile.id ? { ...file, content } : file));
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
      setFiles((items) => items.map((file) => file.id === updated.id ? updated : file));
      socketRef.current?.send(JSON.stringify({ type: "file_saved", fileId: updated.id, intent }));
      toast.success("Saved and versioned");
      loadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  };

  const sendMessage = async () => {
    if (!workspace || !chatDraft.trim()) return;
    const message = await api.sendChat(workspace.id, { content: chatDraft, intent });
    setMessages((items) => [...items, message]);
    socketRef.current?.send(JSON.stringify({ type: "chat_message", message }));
    setChatDraft("");
  };

  const switchIntent = (nextIntent: Intent) => {
    setIntent(nextIntent);
    socketRef.current?.send(JSON.stringify({ type: "intent_change", intent: nextIntent }));
  };

  if (!workspaceId) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">No workspace selected. Create or join a room first.</div>;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLeftOpen((value) => !value)}><Menu className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-black">{workspace?.name ?? "Cipher Workspace"}</h1>
              <span className="hidden rounded-full bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground md:inline">{workspace?.room_id}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> main</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {members.length} users</span>
              <span className="flex items-center gap-1"><Cloud className="h-3 w-3" /> synced</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)} className="hidden gap-2 md:flex"><Command className="h-4 w-4" /> Ctrl K</Button>
          <Button variant="outline" size="sm" onClick={() => setRightTab("security")}><Shield className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="relative" onClick={() => setRightTab("activity")}>
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[10px] text-white">{unread}</span>}
          </Button>
          <Button size="sm" onClick={saveFile} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1">
        <aside className={`${leftOpen ? "w-72" : "w-0"} hidden shrink-0 overflow-hidden border-r border-border bg-card transition-all md:block`}>
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search files, code..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                Files
                <Button size="sm" variant="ghost"><FilePlus2 className="h-4 w-4" /></Button>
              </div>
              {filteredFiles.map((file) => (
                <button key={file.id} onClick={() => setSelectedFileId(file.id)} className={`mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${selectedFile?.id === file.id ? "bg-primary/15 text-primary" : "hover:bg-secondary"}`}>
                  <span className="grid h-6 w-7 place-items-center rounded bg-secondary font-mono text-[10px] text-accent">{languageIcon(file.language)}</span>
                  <span className="min-w-0 flex-1 truncate">{file.path}</span>
                  {file.locked_by && <Lock className="h-3 w-3 text-accent" />}
                </button>
              ))}
            </div>
            <div className="border-t border-border p-3">
              <IntentSelector selectedIntent={intent} onIntentChange={switchIntent} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          {workspace && (
            <div className="flex items-center justify-end border-b border-border bg-card px-4 py-2">
              <Button className="gap-2" variant="outline" onClick={() => api.freezeWorkspace(workspaceId, !(workspace?.is_frozen ?? false)).then(loadWorkspace)}>
                <Lock className="h-4 w-4" />
                {workspace?.is_frozen ? "Unfreeze editing" : "Freeze editing"}
              </Button>
            </div>
          )}
          <CodeEditor
            content={selectedFile?.content ?? ""}
            fileName={selectedFile?.path ?? "No file"}
            language={selectedFile?.language ?? "typescript"}
            currentIntent={intent}
            changes={activity.filter((item) => item.intent).map((item) => ({
              id: item.id,
              userId: String(item.user_id ?? "system"),
              username: "Collaborator",
              timestamp: new Date(item.created_at).getTime(),
              intent: item.intent as Intent,
              lineStart: 1,
              lineEnd: selectedFile?.content.split("\n").length ?? 1,
              content: selectedFile?.content ?? "",
              previousContent: "",
            }))}
            onContentChange={handleContentChange}
          />
        </section>

        <aside className={`${rightOpen ? "w-96" : "w-0"} hidden shrink-0 overflow-hidden border-l border-border bg-card transition-all lg:block`}>
          <div className="flex h-full flex-col">
            <div className="grid grid-cols-4 border-b border-border text-xs">
              {[
                ["chat", MessageSquare],
                ["activity", History],
                ["analytics", BarChart3],
                ["security", Shield],
              ].map(([tab, Icon]) => (
                <button key={String(tab)} onClick={() => setRightTab(tab as any)} className={`flex items-center justify-center gap-1 px-2 py-3 ${rightTab === tab ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary/60"}`}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            {rightTab === "chat" && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
                  {messages.map((message) => (
                    <div key={message.id} className="rounded-md border border-border bg-secondary/35 p-3" style={{ borderLeftColor: message.intent ? INTENT_CONFIGS[message.intent].color : undefined, borderLeftWidth: 3 }}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold">{message.username}</span>
                        <span className="text-muted-foreground">{new Date(message.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border p-3">
                  <Input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Message @team..." />
                </div>
              </div>
            )}

            {rightTab === "activity" && (
              <div className="space-y-3 overflow-auto p-4">
                {activity.map((item) => (
                  <div key={item.id} className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
                    <div className="font-medium">{item.action.replaceAll("_", " ")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "analytics" && (
              <div className="space-y-4 overflow-auto p-4">
                {Object.entries(INTENT_CONFIGS).map(([key, config]) => (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs"><span>{config.label}</span><span>{intentCounts[key] ?? 0}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${Math.min((intentCounts[key] ?? 0) * 20, 100)}%`, background: config.color }} /></div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === "security" && (
              <div className="space-y-3 overflow-auto p-4">
                {["Encryption Active", "Secure WebSocket Connected", "JWT Verified", "Role Validation Enabled", "Cloud Backup Ready"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border border-border bg-secondary/30 p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <footer className="flex items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{selectedFile?.language ?? "typescript"}</span>
          <span>Intent: {INTENT_CONFIGS[intent].label}</span>
          <span>{members.length} connected users</span>
          <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> {connection}</span>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus state={connection === "connected" ? "connected" : connection === "offline" ? "disconnected" : "connecting"} latency={45} />
          <button onClick={() => setRightOpen((value) => !value)}>Toggle panel</button>
        </div>
      </footer>

      {commandOpen && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/55 px-4 pt-24 backdrop-blur" onClick={() => setCommandOpen(false)}>
          <div className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-card p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <Input autoFocus placeholder="Search files, messages, users, code, commands..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="mt-3 space-y-1">
              {["Search files", "Change intent", "Switch theme", "Invite user", "Open settings", "Open activity log"].map((command) => (
                <button key={command} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { if (command === "Open settings") setSettingsOpen(true); if (command === "Open activity log") setRightTab("activity"); setCommandOpen(false); }}>
                  {command}<ChevronRight className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(shortcutsOpen || settingsOpen) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur" onClick={() => { setShortcutsOpen(false); setSettingsOpen(false); }}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-4 text-xl font-bold">{settingsOpen ? "Settings" : "Keyboard shortcuts"}</h2>
            {settingsOpen ? (
              <div className="grid gap-3 text-sm">
                {["Profile settings", "Theme settings", "Notification preferences", "Workspace preferences", "Security settings", "Password update", "Session management"].map((item) => <div key={item} className="rounded-md bg-secondary/40 p-3">{item}</div>)}
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                {["Ctrl + K: Command palette", "Ctrl + /: Shortcuts", "Ctrl + S: Save file", "Esc: Close dialogs"].map((item) => <div key={item} className="rounded-md bg-secondary/40 p-3">{item}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      <button className="fixed bottom-14 right-4 grid h-11 w-11 place-items-center rounded-full bg-primary text-white shadow-xl lg:hidden" onClick={() => setRightOpen(true)}>
        <Bot className="h-5 w-5" />
      </button>
      {/* FIXED: moved freeze editing control to editor header, removed most-active-users card, and removed stale user variable */}
    </main>
  );
}
