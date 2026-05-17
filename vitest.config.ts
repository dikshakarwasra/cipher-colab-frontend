import { mergeConfig } from "vite";
import viteConfig from "./vite.config";

export default mergeConfig(viteConfig, {
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "../shared/**/*.test.ts"],
  },
});

// FIXED: removed legacy server test glob
