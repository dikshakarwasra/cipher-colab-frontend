import { useState, useCallback } from "react";
import { INTENTS, type Intent } from "@shared/intents";
import type { CodeChange, ChatMessage, CollaborativeFile } from "@shared/types";

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  language?: string;
}

interface WorkspaceState {
  currentFileId: string;
  currentFileContent: string;
  files: FileNode[];
  codeChanges: CodeChange[];
  chatMessages: ChatMessage[];
  activeUsers: Array<{
    id: string;
    username: string;
    role: "admin" | "editor" | "viewer";
    currentIntent?: Intent;
    isOnline: boolean;
    cursorPosition?: { line: number; column: number };
  }>;
}

const INITIAL_FILES: FileNode[] = [
  {
    id: "1",
    name: "src",
    type: "folder",
    children: [
      { id: "2", name: "index.ts", type: "file", language: "typescript" },
      { id: "3", name: "utils.ts", type: "file", language: "typescript" },
      {
        id: "4",
        name: "components",
        type: "folder",
        children: [
          { id: "5", name: "Button.tsx", type: "file", language: "typescript" },
          { id: "6", name: "Card.tsx", type: "file", language: "typescript" },
        ],
      },
    ],
  },
  { id: "7", name: "package.json", type: "file", language: "json" },
  { id: "8", name: "README.md", type: "file", language: "markdown" },
];

const INITIAL_CODE = `// Cipher Collab Code Editor
// Select an intent and start editing!

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Test the function
console.log(fibonacci(10));`;

/**
 * Hook for managing workspace state
 * Handles file switching, code changes, chat messages, and user presence
 */
export function useWorkspaceState() {
  const [state, setState] = useState<WorkspaceState>({
    currentFileId: "2",
    currentFileContent: INITIAL_CODE,
    files: INITIAL_FILES,
    codeChanges: [],
    chatMessages: [
      {
        id: "1",
        userId: "user2",
        username: "Alice",
        content: "Let's implement the feature today!",
        timestamp: Date.now() - 300000,
        intent: INTENTS.FEATURE_DEVELOPMENT,
      },
      {
        id: "2",
        userId: "user3",
        username: "Bob",
        content: "Sounds good! I'll start with the API layer.",
        timestamp: Date.now() - 240000,
        intent: INTENTS.FEATURE_DEVELOPMENT,
      },
    ],
    activeUsers: [
      {
        id: "user1",
        username: "You",
        role: "editor",
        currentIntent: INTENTS.FEATURE_DEVELOPMENT,
        isOnline: true,
        cursorPosition: { line: 5, column: 12 },
      },
      {
        id: "user2",
        username: "Alice",
        role: "editor",
        currentIntent: INTENTS.DEBUGGING,
        isOnline: true,
        cursorPosition: { line: 8, column: 5 },
      },
      {
        id: "user3",
        username: "Bob",
        role: "viewer",
        currentIntent: INTENTS.FEATURE_DEVELOPMENT,
        isOnline: false,
      },
    ],
  });

  const switchFile = useCallback((fileId: string) => {
    setState((prev) => {
      // Find file content (in real app, would load from backend)
      let content = INITIAL_CODE;
      if (fileId === "7") {
        content = JSON.stringify(
          {
            name: "cipher-collab",
            version: "1.0.0",
            dependencies: { react: "^19.0.0", typescript: "^5.0.0" },
          },
          null,
          2
        );
      } else if (fileId === "8") {
        content = `# Cipher Collab\n\nA real-time secure collaboration platform.\n\n## Features\n- Intent-based editing\n- Real-time chat\n- Multi-user cursors`;
      }

      return {
        ...prev,
        currentFileId: fileId,
        currentFileContent: content,
      };
    });
  }, []);

  const updateFileContent = useCallback((content: string, intent: Intent) => {
    setState((prev) => {
      const newChange: CodeChange = {
        id: `change-${Date.now()}`,
        userId: "user1",
        username: "You",
        timestamp: Date.now(),
        intent,
        lineStart: 1,
        lineEnd: content.split("\n").length,
        content,
        previousContent: prev.currentFileContent,
      };

      return {
        ...prev,
        currentFileContent: content,
        codeChanges: [...prev.codeChanges, newChange],
      };
    });
  }, []);

  const addChatMessage = useCallback((content: string, intent?: Intent) => {
    setState((prev) => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        userId: "user1",
        username: "You",
        content,
        timestamp: Date.now(),
        intent,
      };

      return {
        ...prev,
        chatMessages: [...prev.chatMessages, newMessage],
      };
    });
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setState((prev) => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        userId: "system",
        username: "System",
        content,
        timestamp: Date.now(),
        isSystemMessage: true,
      };

      return {
        ...prev,
        chatMessages: [...prev.chatMessages, newMessage],
      };
    });
  }, []);

  const updateUserIntent = useCallback((userId: string, intent: Intent) => {
    setState((prev) => {
      const updatedUsers = prev.activeUsers.map((user) =>
        user.id === userId ? { ...user, currentIntent: intent } : user
      );

      return {
        ...prev,
        activeUsers: updatedUsers,
      };
    });

    // Add system message
    addSystemMessage(`User changed intent to ${intent}`);
  }, [addSystemMessage]);

  const updateUserCursor = useCallback(
    (userId: string, line: number, column: number) => {
      setState((prev) => {
        const updatedUsers = prev.activeUsers.map((user) =>
          user.id === userId
            ? { ...user, cursorPosition: { line, column } }
            : user
        );

        return {
          ...prev,
          activeUsers: updatedUsers,
        };
      });
    },
    []
  );

  return {
    ...state,
    switchFile,
    updateFileContent,
    addChatMessage,
    addSystemMessage,
    updateUserIntent,
    updateUserCursor,
  };
}
