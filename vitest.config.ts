import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Scope the test runner to the app's own unit tests. Without this, vitest walks
// the whole repo (including .claude/skills/* which import bun:test) and reports
// hundreds of spurious failures.
//
// The `@` alias mirrors tsconfig.json so platform modules that import via
// `@/lib/...` (and their tests, which use relative imports) resolve in vitest.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", ".claude", "mcp-server", "dist", "**/*.spec.ts"],
  },
});
