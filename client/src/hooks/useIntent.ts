import { useState, useCallback } from "react";
import { INTENTS, type Intent } from "@shared/intents";

/**
 * Hook for managing user's current collaboration intent
 * Persists intent selection to localStorage
 */
export function useIntent(defaultIntent: Intent | null = null) {
  const [intent, setIntent] = useState<Intent | null>(() => {
    // Try to load from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cipherCollabIntent");
      if (stored && Object.values(INTENTS).includes(stored as Intent)) {
        return stored as Intent;
      }
    }
    return defaultIntent;
  });

  const changeIntent = useCallback((newIntent: Intent) => {
    setIntent(newIntent);
    if (typeof window !== "undefined") {
      localStorage.setItem("cipherCollabIntent", newIntent);
    }
  }, []);

  return { intent, changeIntent };
}
