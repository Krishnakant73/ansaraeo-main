import { defineConfig } from "vitest/config";

// Scope the test runner to the app's own unit tests. Without this, vitest walks
// the whole repo (including .claude/skills/* which import bun:test) and reports
// hundreds of spurious failures.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", ".claude", "mcp-server", "dist", "**/*.spec.ts"],
  },
});
