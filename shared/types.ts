/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export * from "./_core/errors";

import type { Intent } from "./intents";

export interface CodeChange {
  id: string;
  userId: string;
  username: string;
  timestamp: number;
  intent: Intent;
  lineStart: number;
  lineEnd: number;
  content: string;
  previousContent: string;
  description?: string;
}

export interface CollaborativeUser {
  id: string;
  username: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  avatar?: string;
  currentIntent?: Intent;
  isOnline: boolean;
  lastSeen: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  intent?: Intent;
  isSystemMessage?: boolean;
}

export interface CollaborativeFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  lastModified: number;
  lastModifiedBy: string;
}

export interface Workspace {
  id: string;
  name: string;
  roomId: string;
  createdAt: number;
  createdBy: string;
  members: CollaborativeUser[];
  files: CollaborativeFile[];
  changes: CodeChange[];
  messages: ChatMessage[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  intent?: Intent;
  timestamp: number;
  details?: Record<string, unknown>;
}

// FIXED: removed legacy Drizzle schema type export
