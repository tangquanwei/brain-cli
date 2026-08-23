import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { REPO_ROOT } from "./utils/paths.js";

loadDotenv({ path: resolve(REPO_ROOT, ".env") });

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return ["true", "1", "yes"].includes(v.toLowerCase());
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export interface Settings {
  notesDir: string;
  gitAutoCommit: boolean;
  commitInterval: number;
  pushInterval: number;
  watchEnabled: boolean;
}

export const settings: Settings = {
  notesDir: resolve(REPO_ROOT, process.env.NOTES_DIR ?? "notes"),
  gitAutoCommit: envBool("GIT_AUTO_COMMIT", true),
  commitInterval: envInt("COMMIT_INTERVAL", 30),
  pushInterval: envInt("PUSH_INTERVAL", 900),
  watchEnabled: envBool("WATCH_ENABLED", true),
};

export const PARA_DIRS = ["projects", "areas", "resources", "archives"] as const;

export function ensureNotesDir(): void {
  for (const sub of PARA_DIRS) {
    mkdirSync(resolve(settings.notesDir, sub), { recursive: true });
  }
}
