import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// The iOS tests run in America/Managua (Fixtures.calendar); the npm script sets TZ to match, since
// month and day boundaries depend on it.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
})
