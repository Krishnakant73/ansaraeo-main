import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// Dedicated config for the deterministic end-to-end workflow validation.
// It is SEPARATE from vitest.config.ts (which deliberately omits the `@/` alias
// per CLAUDE.md) so that `npm test` never pulls the live-DB e2e suite into the
// normal unit run. Run explicitly:
//   npx vitest run --config vitest.e2e.config.ts validation/workflow-e2e.test.ts
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      // Stub next/headers so importing server modules never touches request
      // context (cookies()) during a Node test run.
      "next/headers": path.resolve(root, "validation/__stubs__/next-headers.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["validation/**/*.test.ts"],
    // Never hit the network / real engines — this is fully deterministic.
    testTimeout: 60000,
  },
});
