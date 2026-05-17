import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, signup } from "@/lib/api";
import { KeyRound, Loader2, Lock, Shield, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function passwordScore(password: string) {
  return [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
}

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginId, setLoginId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const score = passwordScore(password);
  const strength = useMemo(() => {
    if (!password) return { label: "Password strength", width: "0%", color: "bg-muted" };
    if (score <= 1) return { label: "Weak", width: "33%", color: "bg-destructive" };
    if (score <= 3) return { label: "Medium", width: "66%", color: "bg-accent" };
    return { label: "Strong", width: "100%", color: "bg-green-500" };
  }, [password, score]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (mode === "signup") {
        await signup({ username, email, password, display_name: displayName || username });
        toast.success("Account created. Secure session started.");
      } else {
        await login({ login: loginId, password });
        toast.success("Welcome back to Cipher Collab.");
      }
      navigate("/role-room");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#101522] text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      </div>

      <section className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.02fr_.98fr] lg:px-8">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
            <Shield className="h-4 w-4 text-green-400" />
            AES-256 encrypted workspace
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal md:text-7xl">
              Cipher Collab
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              A secure developer workspace for real-time code, chat, intent tracking, version replay, and admin-controlled collaboration.
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 rounded-lg border border-white/10 bg-card/65 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-accent" />
                Live collaboration preview
              </div>
              <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-300">Stable</span>
            </div>
            <pre className="overflow-hidden rounded-md bg-background/80 p-4 font-mono text-xs leading-6 text-muted-foreground">
              <span className="text-blue-300">Diksha</span> is typing in <span className="text-accent">app.py</span>{"\n"}
              <span className="text-red-300">Rohit</span> switched to Debugging intent{"\n"}
              <span className="text-green-300">Aman</span> saved src/index.ts{"\n\n"}
              <span className="text-primary">def</span> secure_room_token(room_id):{"\n"}
              {"  "}return encrypt(room_id)
            </pre>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-lg border border-white/10 bg-card/90 p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{mode === "login" ? "Sign in" : "Create account"}</h2>
                <p className="text-sm text-muted-foreground">Last login from Jaipur, India</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                <Lock className="h-5 w-5" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Display name</Label>
                    <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Diksha Sharma" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="login">Username or email</Label>
                  <Input id="login" value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>

              <Button type="submit" disabled={isLoading} className="h-11 w-full gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {mode === "login" ? "Sign in securely" : "Create secure workspace account"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Create account" : "Sign in"}
              </button>
            </div>
            {/* FIXED: removed unused OAuth block from login card */}
          </div>
        </div>
      </section>
    </main>
  );
}
