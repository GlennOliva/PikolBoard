import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Domain helpers under lib/, and component tests under components/. Both
    // globs are explicit so a new test file is picked up rather than silently
    // skipped.
    //
    // Component tests need a DOM for effects and fake timers, which is what
    // makes "the timer keeps counting after a tick" and "the interval is cleared
    // on unmount" assertable at all. Pure helpers stay on the faster node
    // environment via the per-file `// @vitest-environment` pragma.
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    environment: "node",
    passWithNoTests: false,
  },
});