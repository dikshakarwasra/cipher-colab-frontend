import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceState } from "./useWorkspaceState";
import { INTENTS } from "@shared/intents";

describe("useWorkspaceState hook", () => {
  it("should initialize with default state", () => {
    const { result } = renderHook(() => useWorkspaceState());

    expect(result.current.currentFileId).toBe("2");
    expect(result.current.files).toHaveLength(3);
    expect(result.current.codeChanges).toHaveLength(0);
    expect(result.current.chatMessages).toHaveLength(2);
    expect(result.current.activeUsers).toHaveLength(3);
  });

  it("should switch files", () => {
    const { result } = renderHook(() => useWorkspaceState());

    act(() => {
      result.current.switchFile("7");
    });

    expect(result.current.currentFileId).toBe("7");
    expect(result.current.currentFileContent).toContain("cipher-collab");
  });

  it("should update file content and track changes", () => {
    const { result } = renderHook(() => useWorkspaceState());
    const newContent = "console.log('Hello, World!');";

    act(() => {
      result.current.updateFileContent(newContent, INTENTS.FEATURE_DEVELOPMENT);
    });

    expect(result.current.currentFileContent).toBe(newContent);
    expect(result.current.codeChanges).toHaveLength(1);
    expect(result.current.codeChanges[0].intent).toBe(
      INTENTS.FEATURE_DEVELOPMENT
    );
  });

  it("should add chat messages", () => {
    const { result } = renderHook(() => useWorkspaceState());
    const initialCount = result.current.chatMessages.length;

    act(() => {
      result.current.addChatMessage("Hello!", INTENTS.DEBUGGING);
    });

    expect(result.current.chatMessages).toHaveLength(initialCount + 1);
    expect(result.current.chatMessages[initialCount].content).toBe("Hello!");
    expect(result.current.chatMessages[initialCount].intent).toBe(
      INTENTS.DEBUGGING
    );
  });

  it("should add system messages", () => {
    const { result } = renderHook(() => useWorkspaceState());
    const initialCount = result.current.chatMessages.length;

    act(() => {
      result.current.addSystemMessage("User joined the room");
    });

    expect(result.current.chatMessages).toHaveLength(initialCount + 1);
    expect(result.current.chatMessages[initialCount].isSystemMessage).toBe(
      true
    );
    expect(result.current.chatMessages[initialCount].username).toBe("System");
  });

  it("should update user intent and add system message", () => {
    const { result } = renderHook(() => useWorkspaceState());
    const initialMessageCount = result.current.chatMessages.length;

    act(() => {
      result.current.updateUserIntent("user1", INTENTS.DEBUGGING);
    });

    // Check user intent updated
    const user = result.current.activeUsers.find((u) => u.id === "user1");
    expect(user?.currentIntent).toBe(INTENTS.DEBUGGING);

    // Check system message added
    expect(result.current.chatMessages).toHaveLength(initialMessageCount + 1);
    const lastMessage = result.current.chatMessages[initialMessageCount];
    expect(lastMessage.isSystemMessage).toBe(true);
  });

  it("should update user cursor position", () => {
    const { result } = renderHook(() => useWorkspaceState());

    act(() => {
      result.current.updateUserCursor("user1", 10, 5);
    });

    const user = result.current.activeUsers.find((u) => u.id === "user1");
    expect(user?.cursorPosition).toEqual({ line: 10, column: 5 });
  });

  it("should track multiple code changes", () => {
    const { result } = renderHook(() => useWorkspaceState());

    act(() => {
      result.current.updateFileContent("version 1", INTENTS.FEATURE_DEVELOPMENT);
      result.current.updateFileContent("version 2", INTENTS.DEBUGGING);
      result.current.updateFileContent("version 3", INTENTS.REFACTORING);
    });

    expect(result.current.codeChanges).toHaveLength(3);
    expect(result.current.codeChanges[0].intent).toBe(
      INTENTS.FEATURE_DEVELOPMENT
    );
    expect(result.current.codeChanges[1].intent).toBe(INTENTS.DEBUGGING);
    expect(result.current.codeChanges[2].intent).toBe(INTENTS.REFACTORING);
  });
});
