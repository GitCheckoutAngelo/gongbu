import { defineConfig } from "vitest/config";

// Unit tests (plain Node; external APIs are mocked): the Worker, plus frontend data and logic.
export default defineConfig({
  test: {
    include: ["worker/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
