import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, clearAuth, type ApiWorkspace } from "@/lib/api";
import { Boxes, Check, Cloud, Code2, Copy, Crown, Eye, FileCode2, Loader2, LogOut, Plus, Shield, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const roles = [
  { id: "admin", label: "Admin", icon: Crown, ability: "Approve users, lock files, freeze editing" },
  { id: "editor", label: "Editor", icon: FileCode2, ability: "Create files, edit code, chat" },
  { id: "viewer", label: "Viewer", icon: Eye, ability: "Read-only workspace access" },
] as const;

const templates = [
  { id: "python", label: "Python Project", icon: Code2, desc: "Flask/FastAPI starter" },
  { id: "web", label: "Web App", icon: Boxes, desc: "HTML/CSS/JS starter" },
  { id: "react", label: "React App", icon: Star, desc: "Vite + React + TypeScript" },
  { id: "empty", label: "Empty Workspace", icon: Plus, desc: "Start from scratch" },
] as const;

export default function RoleAndRoom() {
  const [, navigate] = useLocation();
  const [role, setRole] = useState<(typeof roles)[number]["id"]>("editor");
  const [roomId, setRoomId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Cipher Workspace");
  const [template, setTemplate] = useState("python");
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.listWorkspaces().then(setWorkspaces).catch(() => setWorkspaces([]));
  }, []);

  const enterWorkspace = (workspaceId: string) => {
    localStorage.setItem("cipher-collab-workspace-id", workspaceId);
    navigate(`/workspace?workspace=${workspaceId}`);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const workspace = await api.createWorkspace({ name: workspaceName, template, description: "Secure collaborative workspace" });
      toast.success(`Workspace created: ${workspace.room_id}`);
      setWorkspaces((cur) => [workspace, ...cur]);
      enterWorkspace(workspace.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.joinRoom({ room_id: roomId.trim().toUpperCase(), requested_role: role });
      if (result.status === "pending_approval") {
        toast.info("Waiting for admin approval...");
      } else {
        toast.success("Joined workspace");
        enterWorkspace(result.workspace_id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to join workspace");
    } finally {
      setLoading(false);
    }
  };

  const copyRoom = async (workspace: ApiWorkspace) => {
    await navigator.clipboard.writeText(workspace.room_id);
    setCopied(workspace.room_id);
    toast.success("Room ID copied");
    window.setTimeout(() => setCopied(null), 1200);
  };

  return (
    <main className="min-h-screen cipher-ambient bg-[#0F172A] text-[#F8FAFC]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111827]/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-[#38BDF8] shadow-lg shadow-[#38BDF8]/25">
              <Code2 className="h-4 w-4 text-[#0F172A]" />
            </div>
            <div>
              <h1 className="text-base font-black leading-none">Cipher Collab</h1>
              <p className="text-[10px] text-[#94A3B8]">Cloud synced workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs text-green-300 sm:flex">
              <Shield className="h-3 w-3" /> Secure session
            </span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { clearAuth(); navigate("/"); }}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="relative grid gap-5 lg:grid-cols-2">

          {/* ── LEFT COLUMN ─────────────────────────────────── */}
          <div className="space-y-5">

            {/* Recent workspaces */}
            <div className="glass-panel rounded-lg p-4">
              <h2 className="mb-3 text-base font-bold">Continue where you left off</h2>
              {workspaces.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-[#111827]/45 p-5 text-center text-sm text-[#94A3B8]">
                  No recent rooms yet. Create one and it will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <div key={ws.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#111827]/65 px-3 py-2.5 hover:bg-[#1E293B]">
                      <button className="min-w-0 flex-1 text-left" onClick={() => enterWorkspace(ws.id)}>
                        <div className="truncate font-medium text-sm">{ws.name}</div>
                        <div className="font-mono text-xs text-[#94A3B8]">{ws.room_id}</div>
                      </button>
                      <Button size="sm" variant="ghost" className="ml-2 h-7 w-7 p-0 flex-shrink-0" onClick={() => copyRoom(ws)}>
                        {copied === ws.room_id ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Join workspace */}
            <form onSubmit={handleJoin} className="glass-panel rounded-lg p-4">
              <h2 className="mb-3 text-base font-bold">Join workspace</h2>
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="room" className="text-xs">Room ID</Label>
                  <Input
                    id="room"
                    placeholder="DEV-7H2K-91"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>

                {/* Role selection — horizontal compact cards on mobile */}
                <div className="grid gap-2">
                  <Label className="text-xs">Select role</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {roles.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRole(item.id)}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition ${role === item.id ? "border-[#38BDF8] bg-[#38BDF8]/10 text-[#67E8F9] shadow-[0_0_28px_rgba(56,189,248,.16)]" : "border-white/10 bg-[#111827]/55 text-[#94A3B8] hover:border-[#67E8F9]/50 hover:bg-[#1E293B] hover:text-[#F8FAFC]"}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-semibold">{item.label}</span>
                          <span className="hidden text-[9px] leading-tight opacity-70 sm:block">{item.ability}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button className="h-10 w-full gap-2 bg-[#38BDF8] text-[#0F172A] hover:bg-[#67E8F9]" disabled={loading || !roomId}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                  Join or request approval
                </Button>
              </div>
            </form>
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────────── */}
          <div className="glass-panel rounded-lg p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Create workspace</h2>
                <p className="text-xs text-[#94A3B8]">Choose a template and start a secure live session.</p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[#38BDF8]/10 px-3 py-1 text-xs text-[#67E8F9]">
                <Cloud className="h-3 w-3" /> Cloud synced
              </span>
            </div>

            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="wsName" className="text-xs">Workspace name</Label>
                <Input
                  id="wsName"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="My Workspace"
                />
              </div>

              {/* Template cards — 2×2 grid, touch-friendly */}
              <div className="grid grid-cols-2 gap-2.5">
                {templates.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTemplate(item.id)}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${template === item.id ? "border-[#67E8F9] bg-[#38BDF8]/10 text-[#F8FAFC] shadow-[0_0_28px_rgba(103,232,249,.13)]" : "border-white/10 bg-[#111827]/55 text-[#94A3B8] hover:border-[#67E8F9]/50 hover:bg-[#1E293B] hover:text-[#F8FAFC]"}`}
                    >
                      <Icon className={`mb-2 h-5 w-5 ${template === item.id ? "text-[#67E8F9]" : "text-[#94A3B8]"}`} />
                      <div className="text-xs font-semibold">{item.label}</div>
                      <div className="mt-0.5 text-[10px] opacity-70 leading-snug">{item.desc}</div>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={handleCreate}
                disabled={loading || !workspaceName.trim()}
                className="h-10 w-full gap-2 bg-[#38BDF8] text-[#0F172A] hover:bg-[#67E8F9]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create and enter workspace
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
