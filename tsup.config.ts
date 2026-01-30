import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/add-order.ts",
    "src/assignee.ts",
    "src/cli.ts",
    "src/index.ts",
    "src/task-ordering.ts",
    "src/todoist-sync.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  sourcemap: true,
  shims: true,
});
