import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // "server-only" lança fora do React Server; nos testes vira um stub vazio.
      "server-only": path.resolve(__dirname, "tests/unit/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
