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
  { id: "editor", label: "Editor", icon: FileCode2, ability: "Create files, edit code, chat with intent" },
  { id: "viewer", label: "Viewer", icon: Eye, ability: "Read-only workspace access" },
] as const;

const templates = [
  { id: "python", label: "Python Project", icon: Code2 },
  { id: "web", label: "Web App", icon: Boxes },
  { id: "react", label: "React App", icon: Star },
  { id: "empty", label: "Empty Workspace", icon: Plus },
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
      const workspace = await api.createWorkspace({ name: workspaceName, template, description: "Secure collaborative developer workspace" });
      toast.success(`Workspace created: ${workspace.room_id}`);
      setWorkspaces((current) => [workspace, ...current]);
      enterWorkspace(workspace.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await api.joinRoom({ room_id: roomId.trim().toUpperCase(), requested_role: role });
      if (result.status === "pending_approval") {
        toast.info("Waiting for admin approval...");
      } else {
        toast.success("Joined workspace");
        enterWorkspace(result.workspace_id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to join workspace");
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
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Cipher Collab</h1>
            <p className="text-xs text-muted-foreground">Cloud synced every 30 seconds</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs text-green-300 sm:flex">
              <Shield className="h-3 w-3" />
              Secure session
            </span>
            <Button variant="outline" size="sm" onClick={() => { clearAuth(); navigate("/"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-xl font-bold">Continue where you left off</h2>
            <div className="space-y-3">
              {workspaces.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">No recent rooms yet. Create one and it will appear here.</div>
              ) : workspaces.map((workspace) => (
                <div key={workspace.id} className="flex items-center justify-between rounded-md border border-border bg-secondary/40 p-3">
                  <button className="text-left" onClick={() => enterWorkspace(workspace.id)}>
                    <div className="font-medium">{workspace.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{workspace.room_id}</div>
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => copyRoom(workspace)}>
                    {copied === workspace.room_id ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleJoin} className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-xl font-bold">Join workspace</h2>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="room">Room ID</Label>
                <Input id="room" placeholder="DEV-7H2K-91" value={roomId} onChange={(event) => setRoomId(event.target.value.toUpperCase())} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {roles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" onClick={() => setRole(item.id)} className={`rounded-lg border p-4 text-left transition ${role === item.id ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/60"}`}>
                      <Icon className="mb-3 h-5 w-5 text-primary" />
                      <div className="font-semibold">{item.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.ability}</div>
                    </button>
                  );
                })}
              </div>
              <Button className="w-full gap-2" disabled={loading || !roomId}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Join or request approval
              </Button>
            </div>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Create workspace</h2>
              <p className="text-sm text-muted-foreground">Choose a template and start a secure live session.</p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
              <Cloud className="h-3 w-3" />
              Cloud synced
            </span>
          </div>

          <div className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input id="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onClick={() => setTemplate(item.id)} className={`rounded-lg border p-5 text-left ${template === item.id ? "border-accent bg-accent/10" : "border-border bg-secondary/30 hover:border-accent/60"}`}>
                    <Icon className="mb-4 h-6 w-6 text-accent" />
                    <div className="font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Starter files, intent tracking, chat, and version history.</div>
                  </button>
                );
              })}
            </div>
            <Button onClick={handleCreate} disabled={loading || !workspaceName} className="h-11 w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create and enter workspace
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
