import { cpSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    target: "node20",
    outDir: "dist",
    clean: true,
    shims: true,
    banner: { js: "#!/usr/bin/env node" },
    splitting: false,
    sourcemap: true,
    dts: false,
  },
  {
    entry: { app: "web-ui/main.tsx" },
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    outDir: "dist/web",
    clean: false,
    minify: true,
    splitting: true,
    sourcemap: false,
    dts: false,
    noExternal: [
      "react",
      "react-dom",
      "cytoscape",
      "marked",
      "@excalidraw/excalidraw",
      "dompurify",
    ],
    async onSuccess() {
      mkdirSync("dist/web/excalidraw", { recursive: true });
      cpSync(
        "node_modules/@excalidraw/excalidraw/dist/prod/fonts",
        "dist/web/excalidraw/fonts",
        { recursive: true },
      );
    },
    esbuildOptions(options) {
      options.jsx = "automatic";
      options.conditions = ["production"];
      options.define = {
        ...options.define,
        "process.env.NODE_ENV": '"production"',
      };
      options.loader = { ...options.loader, ".woff2": "file", ".woff": "file" };
    },
  },
]);
