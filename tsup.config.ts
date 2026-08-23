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
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    outDir: "dist/web",
    clean: false,
    minify: true,
    splitting: false,
    sourcemap: false,
    dts: false,
    noExternal: ["react", "react-dom", "cytoscape", "marked"],
    esbuildOptions(options) {
      options.jsx = "automatic";
    },
  },
]);
