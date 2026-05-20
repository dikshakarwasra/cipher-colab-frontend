import type { Intent } from "@shared/intents";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";
const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
}

export interface TokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: ApiUser;
}

export interface ApiWorkspace {
  id: string;
  room_id: string;
  name: string;
  description?: string | null;
  owner_id: number;
  is_frozen: boolean;
  created_at: string;
}

export interface ApiMember {
  user_id: number;
  username: string;
  display_name: string;
  role: "admin" | "editor" | "viewer";
  muted_chat: boolean;
}

export interface ApiFile {
  id: string;
  workspace_id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  locked_by: number | null;
  is_read_only: boolean;
  updated_at: string;
}

export interface ApiChatMessage {
  id: string;
  workspace_id: string;
  user_id: number | null;
  username: string;
  content: string;
  intent?: Intent | null;
  is_system: boolean;
  created_at: string;
}

export interface ApiActivity {
  id: string;
  workspace_id: string;
  user_id: number | null;
  action: string;
  intent?: Intent | null;
  file_id?: string | null;
  details?: string | null;
  created_at: string;
}

export interface ApiNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  workspace_id?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ApiJoinRequest {
  id: string;
  user_id: number;
  display_name: string;
  requested_role: "admin" | "editor" | "viewer";
  created_at: string;
}

export interface ApiVersion {
  id: string;
  file_id: string;
  version_number: number;
  content: string;
  created_by: number;
  message?: string | null;
  created_at: string;
}

export interface ApiSecurityLog {
  id: string;
  event: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: string | null;
  created_at: string;
}

export interface ApiIntentSummary {
  intent: string;
  count: number;
}

const ACCESS_KEY = "cipher-collab-access-token";
const REFRESH_KEY = "cipher-collab-refresh-token";
const USER_KEY = "cipher-collab-user";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): ApiUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

export function storeTokenBundle(bundle: TokenBundle) {
  localStorage.setItem(ACCESS_KEY, bundle.access_token);
  localStorage.setItem(REFRESH_KEY, bundle.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(bundle.user));
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401 && retry && getRefreshToken()) {
    const refreshed = await refreshToken();
    if (refreshed) return request<T>(path, options, false);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function signup(payload: { username: string; email: string; password: string; display_name: string }) {
  const bundle = await request<TokenBundle>("/auth/signup", { method: "POST", body: JSON.stringify(payload) }, false);
  storeTokenBundle(bundle);
  return bundle;
}

export async function login(payload: { login: string; password: string }) {
  const bundle = await request<TokenBundle>("/auth/login", { method: "POST", body: JSON.stringify(payload) }, false);
  storeTokenBundle(bundle);
  return bundle;
}

export async function refreshToken() {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return null;
  try {
    const bundle = await request<TokenBundle>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }, false);
    storeTokenBundle(bundle);
    return bundle;
  } catch {
    clearAuth();
    return null;
  }
}

export const api = {
  me: () => request<ApiUser>("/auth/me"),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: getRefreshToken() }) }),
  createWorkspace: (payload: { name: string; description?: string; template: string }) =>
    request<ApiWorkspace>("/workspaces", { method: "POST", body: JSON.stringify(payload) }),
  listWorkspaces: () => request<ApiWorkspace[]>("/workspaces"),
  joinRoom: (payload: { room_id: string; requested_role: "admin" | "editor" | "viewer" }) =>
    request<{ status: string; workspace_id: string; role?: string }>("/workspaces/join", { method: "POST", body: JSON.stringify(payload) }),
  getWorkspace: (workspaceId: string) => request<ApiWorkspace>(`/workspaces/${workspaceId}`),
  members: (workspaceId: string) => request<ApiMember[]>(`/workspaces/${workspaceId}/members`),
  files: (workspaceId: string) => request<ApiFile[]>(`/workspaces/${workspaceId}/files`),
  createFile: (workspaceId: string, payload: { name: string; path: string; language: string; content: string }) =>
    request<ApiFile>(`/workspaces/${workspaceId}/files`, { method: "POST", body: JSON.stringify(payload) }),
  updateFile: (workspaceId: string, fileId: string, payload: { content: string; intent?: Intent | null; line_start: number; line_end: number; summary?: string }) =>
    request<ApiFile>(`/workspaces/${workspaceId}/files/${fileId}`, { method: "PUT", body: JSON.stringify(payload) }),
  chat: (workspaceId: string) => request<ApiChatMessage[]>(`/workspaces/${workspaceId}/chat`),
  sendChat: (workspaceId: string, payload: { content: string; intent?: Intent | null }) =>
    request<ApiChatMessage>(`/workspaces/${workspaceId}/chat`, { method: "POST", body: JSON.stringify(payload) }),
  activity: (workspaceId: string) => request<ApiActivity[]>(`/workspaces/${workspaceId}/activity`),
  intentSummary: (workspaceId: string) => request<ApiIntentSummary[]>(`/workspaces/${workspaceId}/intents/summary`),
  fileVersions: (workspaceId: string, fileId: string) => request<ApiVersion[]>(`/workspaces/${workspaceId}/files/${fileId}/versions`),
  restoreVersion: (workspaceId: string, fileId: string, versionId: string) =>
    request<ApiFile>(`/workspaces/${workspaceId}/files/${fileId}/versions/${versionId}/restore`, { method: "POST" }),
  notifications: () => request<ApiNotification[]>("/notifications"),
  markNotificationRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "POST" }),
  securityLogs: () => request<ApiSecurityLog[]>("/security/logs"),
  lockFile: (workspaceId: string, fileId: string, locked: boolean) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/files/${fileId}/lock`, { method: "POST", body: JSON.stringify({ locked }) }),
  freezeWorkspace: (workspaceId: string, frozen: boolean) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/freeze`, { method: "POST", body: JSON.stringify({ frozen }) }),
  getJoinRequests: (workspaceId: string) =>
    request<ApiJoinRequest[]>(`/workspaces/${workspaceId}/admin/join-requests`),
  approveJoinRequest: (workspaceId: string, requestId: string) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/join-requests/${requestId}/approve`, { method: "POST" }),
  rejectJoinRequest: (workspaceId: string, requestId: string) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/join-requests/${requestId}/reject`, { method: "POST" }),
  changeRole: (workspaceId: string, userId: number, role: "admin" | "editor" | "viewer") =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/roles`, { method: "POST", body: JSON.stringify({ user_id: userId, role }) }),
  muteMember: (workspaceId: string, userId: number, muted: boolean) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/members/${userId}/mute`, { method: "POST", body: JSON.stringify({ muted }) }),
  removeMember: (workspaceId: string, userId: number) =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/members/${userId}`, { method: "DELETE" }),
  inviteUser: (workspaceId: string, username: string, role: "admin" | "editor" | "viewer") =>
    request<{ success: boolean }>(`/workspaces/${workspaceId}/admin/invite`, { method: "POST", body: JSON.stringify({ username, role }) }),
};

export function createWorkspaceSocket(workspaceId: string) {
  const token = getAccessToken();
  return new WebSocket(`${WS_BASE}/workspaces/${workspaceId}?token=${encodeURIComponent(token ?? "")}`);
}
