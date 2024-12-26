import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "./vitest.config.ts",
  "./examples/react/vite.config.ts",
  "./packages/trackers/click-tracker/vitest.config.ts",
  "./packages/core/vitest.config.ts",
]);
