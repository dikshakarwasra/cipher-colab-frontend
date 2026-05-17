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
    color: "#1976D2", // Primary Blue
    bgColor: "rgba(25, 118, 210, 0.1)",
    borderColor: "rgba(25, 118, 210, 0.3)",
  },
  [INTENTS.DEBUGGING]: {
    id: INTENTS.DEBUGGING,
    label: "Debugging",
    description: "Fixing bugs and issues",
    color: "#E53935", // Danger Red
    bgColor: "rgba(229, 57, 53, 0.1)",
    borderColor: "rgba(229, 57, 53, 0.3)",
  },
  [INTENTS.REFACTORING]: {
    id: INTENTS.REFACTORING,
    label: "Refactoring",
    description: "Improving code structure and quality",
    color: "#9C27B0", // Purple
    bgColor: "rgba(156, 39, 176, 0.1)",
    borderColor: "rgba(156, 39, 176, 0.3)",
  },
  [INTENTS.TESTING]: {
    id: INTENTS.TESTING,
    label: "Testing",
    description: "Writing and improving tests",
    color: "#2ECC71", // Success Green
    bgColor: "rgba(46, 204, 113, 0.1)",
    borderColor: "rgba(46, 204, 113, 0.3)",
  },
  [INTENTS.DOCUMENTATION]: {
    id: INTENTS.DOCUMENTATION,
    label: "Documentation",
    description: "Writing and updating documentation",
    color: "#FFB74D", // Orange
    bgColor: "rgba(255, 183, 77, 0.1)",
    borderColor: "rgba(255, 183, 77, 0.3)",
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
