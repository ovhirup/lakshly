import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@lakshly/shared": fileURLToPath(new URL("../../packages/shared/index.ts", import.meta.url)), "@lakshly/parsers": fileURLToPath(new URL("../../packages/parsers/src/index.ts", import.meta.url)), "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
