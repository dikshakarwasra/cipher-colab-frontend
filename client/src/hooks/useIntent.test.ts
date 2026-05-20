import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntent } from "./useIntent";
import { INTENTS } from "@shared/intents";

describe("useIntent hook", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should initialize without a selected intent", () => {
    const { result } = renderHook(() => useIntent());
    expect(result.current.intent).toBeNull();
  });

  it("should initialize with custom default intent", () => {
    const { result } = renderHook(() => useIntent(INTENTS.DEBUGGING));
    expect(result.current.intent).toBe(INTENTS.DEBUGGING);
  });

  it("should change intent", () => {
    const { result } = renderHook(() => useIntent());

    act(() => {
      result.current.changeIntent(INTENTS.REFACTORING);
    });

    expect(result.current.intent).toBe(INTENTS.REFACTORING);
  });

  it("should persist intent to localStorage", () => {
    const { result } = renderHook(() => useIntent());

    act(() => {
      result.current.changeIntent(INTENTS.TESTING);
    });

    expect(localStorage.getItem("cipherCollabIntent")).toBe(INTENTS.TESTING);
  });

  it("should load intent from localStorage on init", () => {
    localStorage.setItem("cipherCollabIntent", INTENTS.DOCUMENTATION);

    const { result } = renderHook(() => useIntent());

    expect(result.current.intent).toBe(INTENTS.DOCUMENTATION);
  });

  it("should ignore invalid stored intent and remain neutral", () => {
    localStorage.setItem("cipherCollabIntent", "invalid-intent");

    const { result } = renderHook(() => useIntent());

    expect(result.current.intent).toBeNull();
  });

  it("should support all 5 intents", () => {
    const { result } = renderHook(() => useIntent());

    const intents = [
      INTENTS.FEATURE_DEVELOPMENT,
      INTENTS.DEBUGGING,
      INTENTS.REFACTORING,
      INTENTS.TESTING,
      INTENTS.DOCUMENTATION,
    ];

    intents.forEach((intent) => {
      act(() => {
        result.current.changeIntent(intent);
      });
      expect(result.current.intent).toBe(intent);
    });
  });
});
