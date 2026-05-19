import { describe, it, expect } from "vitest";
import {
  INTENTS,
  INTENT_CONFIGS,
  INTENT_LIST,
  getIntentConfig,
  getIntentLabel,
  getIntentColor,
} from "./intents";

describe("Intent System", () => {
  describe("INTENTS constants", () => {
    it("should have exactly 5 intents", () => {
      expect(Object.keys(INTENTS)).toHaveLength(5);
    });

    it("should have all required intent types", () => {
      expect(INTENTS.FEATURE_DEVELOPMENT).toBe("feature_development");
      expect(INTENTS.DEBUGGING).toBe("debugging");
      expect(INTENTS.REFACTORING).toBe("refactoring");
      expect(INTENTS.TESTING).toBe("testing");
      expect(INTENTS.DOCUMENTATION).toBe("documentation");
    });
  });

  describe("INTENT_CONFIGS", () => {
    it("should have configuration for all intents", () => {
      INTENT_LIST.forEach((intent) => {
        expect(INTENT_CONFIGS[intent]).toBeDefined();
      });
    });

    it("should have unique colors for each intent", () => {
      const colors = INTENT_LIST.map((intent) => INTENT_CONFIGS[intent].color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(INTENT_LIST.length);
    });

    it("should have valid hex color codes", () => {
      INTENT_LIST.forEach((intent) => {
        const config = INTENT_CONFIGS[intent];
        expect(config.color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it("should have all required fields in config", () => {
      INTENT_LIST.forEach((intent) => {
        const config = INTENT_CONFIGS[intent];
        expect(config).toHaveProperty("id");
        expect(config).toHaveProperty("label");
        expect(config).toHaveProperty("description");
        expect(config).toHaveProperty("color");
        expect(config).toHaveProperty("bgColor");
        expect(config).toHaveProperty("borderColor");
      });
    });
  });

  describe("Helper functions", () => {
    it("getIntentConfig should return correct config", () => {
      const config = getIntentConfig(INTENTS.FEATURE_DEVELOPMENT);
      expect(config.label).toBe("Feature Development");
      expect(config.color).toBe("#38BDF8");
    });

    it("getIntentLabel should return correct label", () => {
      expect(getIntentLabel(INTENTS.DEBUGGING)).toBe("Debugging");
      expect(getIntentLabel(INTENTS.REFACTORING)).toBe("Refactoring");
      expect(getIntentLabel(INTENTS.TESTING)).toBe("Testing");
      expect(getIntentLabel(INTENTS.DOCUMENTATION)).toBe("Documentation");
    });

    it("getIntentColor should return correct color", () => {
      expect(getIntentColor(INTENTS.FEATURE_DEVELOPMENT)).toBe("#38BDF8");
      expect(getIntentColor(INTENTS.DEBUGGING)).toBe("#F87171");
      expect(getIntentColor(INTENTS.REFACTORING)).toBe("#A78BFA");
      expect(getIntentColor(INTENTS.TESTING)).toBe("#34D399");
      expect(getIntentColor(INTENTS.DOCUMENTATION)).toBe("#FBBF24");
    });
  });

  describe("Color palette", () => {
    it("should have distinct colors for each intent", () => {
      const colors = {
        [INTENTS.FEATURE_DEVELOPMENT]: "#38BDF8",
        [INTENTS.DEBUGGING]: "#F87171",
        [INTENTS.REFACTORING]: "#A78BFA",
        [INTENTS.TESTING]: "#34D399",
        [INTENTS.DOCUMENTATION]: "#FBBF24",
      };

      Object.entries(colors).forEach(([intent, expectedColor]) => {
        expect(getIntentColor(intent as any)).toBe(expectedColor);
      });
    });

    it("should have valid rgba background colors", () => {
      INTENT_LIST.forEach((intent) => {
        const config = INTENT_CONFIGS[intent];
        expect(config.bgColor).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
      });
    });

    it("should have valid rgba border colors", () => {
      INTENT_LIST.forEach((intent) => {
        const config = INTENT_CONFIGS[intent];
        expect(config.borderColor).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
      });
    });
  });
});
