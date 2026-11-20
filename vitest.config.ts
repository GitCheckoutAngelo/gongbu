import { defineConfig } from "vitest/config";

// Unit tests (plain Node; external APIs are mocked): the Worker, frontend data and logic, and the word-list data.
export default defineConfig({
  test: {
    include: ["worker/**/*.test.ts", "src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
