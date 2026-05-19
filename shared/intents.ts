/**
 * Intent-based collaboration system
 * Each user selects an intent before editing, and all changes are tracked with that intent
 */

export const INTENTS = {
  FEATURE_DEVELOPMENT: "feature_development",
  DEBUGGING: "debugging",
  REFACTORING: "refactoring",
  TESTING: "testing",
  DOCUMENTATION: "documentation",
} as const;

export type Intent = (typeof INTENTS)[keyof typeof INTENTS];

export interface IntentConfig {
  id: Intent;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const INTENT_CONFIGS: Record<Intent, IntentConfig> = {
  [INTENTS.FEATURE_DEVELOPMENT]: {
    id: INTENTS.FEATURE_DEVELOPMENT,
    label: "Feature Development",
    description: "Building new features and functionality",
    color: "#38BDF8",
    bgColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(103, 232, 249, 0.36)",
  },
  [INTENTS.DEBUGGING]: {
    id: INTENTS.DEBUGGING,
    label: "Debugging",
    description: "Fixing bugs and issues",
    color: "#F87171",
    bgColor: "rgba(248, 113, 113, 0.12)",
    borderColor: "rgba(248, 113, 113, 0.32)",
  },
  [INTENTS.REFACTORING]: {
    id: INTENTS.REFACTORING,
    label: "Refactoring",
    description: "Improving code structure and quality",
    color: "#A78BFA",
    bgColor: "rgba(167, 139, 250, 0.12)",
    borderColor: "rgba(167, 139, 250, 0.34)",
  },
  [INTENTS.TESTING]: {
    id: INTENTS.TESTING,
    label: "Testing",
    description: "Writing and improving tests",
    color: "#34D399",
    bgColor: "rgba(52, 211, 153, 0.12)",
    borderColor: "rgba(52, 211, 153, 0.34)",
  },
  [INTENTS.DOCUMENTATION]: {
    id: INTENTS.DOCUMENTATION,
    label: "Documentation",
    description: "Writing and updating documentation",
    color: "#FBBF24",
    bgColor: "rgba(251, 191, 36, 0.12)",
    borderColor: "rgba(251, 191, 36, 0.34)",
  },
};

export const INTENT_LIST = Object.values(INTENTS);

export function getIntentConfig(intent: Intent): IntentConfig {
  return INTENT_CONFIGS[intent];
}

export function getIntentLabel(intent: Intent): string {
  return INTENT_CONFIGS[intent].label;
}

export function getIntentColor(intent: Intent): string {
  return INTENT_CONFIGS[intent].color;
}
