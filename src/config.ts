import { parse as parseDotenv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "./utils/paths.js";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const ENV_KEYS = [
  "NOTES_DIR",
  "GIT_AUTO_COMMIT",
  "WATCH_ENABLED",
  "PUSH_INTERVAL",
  "COMMIT_INTERVAL",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

type EnvSource = "notes" | "home" | "process" | "default";

const DEFAULT_ENV: Record<EnvKey, string> = {
  NOTES_DIR: "notes",
  GIT_AUTO_COMMIT: "true",
  WATCH_ENABLED: "true",
  PUSH_INTERVAL: "900",
  COMMIT_INTERVAL: "30",
};

let explicitVault: string | null = null;

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  try {
    return parseDotenv(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function homeEnvPath(): string {
  return resolve(REPO_ROOT, ".env");
}

export function notesEnvPath(notesDir = settings.notesDir): string {
  return resolve(notesDir, ".env");
}

function envContext(): {
  values: Record<EnvKey, string>;
  sources: Record<EnvKey, EnvSource>;
  home: Record<string, string>;
  notes: Record<string, string>;
  notesPath: string;
} {
  const home = readEnvFile(homeEnvPath());
  const initialNotesDir = resolve(
    REPO_ROOT,
    process.env.NOTES_DIR ?? home.NOTES_DIR ?? DEFAULT_ENV.NOTES_DIR,
  );
  const notesPath = notesEnvPath(initialNotesDir);
  const notes = readEnvFile(notesPath);
  const values = {} as Record<EnvKey, string>;
  const sources = {} as Record<EnvKey, EnvSource>;
  for (const key of ENV_KEYS) {
    if (process.env[key] !== undefined) {
      values[key] = process.env[key]!;
      sources[key] = "process";
    } else if (notes[key] !== undefined) {
      values[key] = notes[key]!;
      sources[key] = "notes";
    } else if (home[key] !== undefined) {
      values[key] = home[key]!;
      sources[key] = "home";
    } else {
      values[key] = DEFAULT_ENV[key];
      sources[key] = "default";
    }
  }
  return { values, sources, home, notes, notesPath };
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return fallback;
}

function parseNonNegativeInt(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return fallback;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export interface Settings {
  notesDir: string;
  gitAutoCommit: boolean;
  commitInterval: number;
  pushInterval: number;
  watchEnabled: boolean;
}

export const settings: Settings = {
  notesDir: resolve(REPO_ROOT, DEFAULT_ENV.NOTES_DIR),
  gitAutoCommit: true,
  commitInterval: 30,
  pushInterval: 900,
  watchEnabled: true,
};

export function reloadSettings(): Settings {
  const context = envContext();
  const values = context.values;
  settings.notesDir = explicitVault ?? resolve(REPO_ROOT, values.NOTES_DIR);
  settings.gitAutoCommit = parseBool(
    values.GIT_AUTO_COMMIT,
    DEFAULT_ENV.GIT_AUTO_COMMIT === "true",
  );
  settings.commitInterval = parseNonNegativeInt(
    values.COMMIT_INTERVAL,
    Number(DEFAULT_ENV.COMMIT_INTERVAL),
  );
  settings.pushInterval = parseNonNegativeInt(
    values.PUSH_INTERVAL,
    Number(DEFAULT_ENV.PUSH_INTERVAL),
  );
  settings.watchEnabled = parseBool(
    values.WATCH_ENABLED,
    DEFAULT_ENV.WATCH_ENABLED === "true",
  );
  return settings;
}

reloadSettings();

export interface SettingsSnapshot {
  values: Record<EnvKey, string>;
  sources: Record<EnvKey, EnvSource>;
  files: { notes: string; home: string; writeTarget: string };
  example: string;
}

export function readSettingsSnapshot(): SettingsSnapshot {
  const context = envContext();
  const values = { ...context.values };
  if (explicitVault) values.NOTES_DIR = settings.notesDir;
  return {
    values,
    sources: context.sources,
    files: {
      notes: context.notesPath,
      home: homeEnvPath(),
      writeTarget: notesEnvPath(settings.notesDir),
    },
    example: existsSync(resolve(CLI_ROOT, ".env.example"))
      ? readFileSync(resolve(CLI_ROOT, ".env.example"), "utf8")
      : "",
  };
}

function writeEnvValues(
  path: string,
  values: Partial<Record<EnvKey, string>>,
): void {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  let output = existing;
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) continue;
    const line = `${key}=${values[key]}`;
    const pattern = new RegExp(`^${key}\\s*=.*$`, "m");
    output = pattern.test(output)
      ? output.replace(pattern, line)
      : `${output.trimEnd()}${output.trimEnd() ? "\n" : ""}${line}\n`;
  }
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, output, "utf8");
}

export function writeSettings(
  values: Partial<Record<EnvKey, string>>,
): SettingsSnapshot {
  const target = notesEnvPath(settings.notesDir);
  writeEnvValues(target, values);
  reloadSettings();
  return readSettingsSnapshot();
}

export function configureVault(vaultPath: string): string {
  const resolved = resolve(process.cwd(), vaultPath);
  explicitVault = resolved;
  settings.notesDir = resolved;
  process.env.NOTES_DIR = resolved;
  return resolved;
}

export const PARA_DIRS = [
  "projects",
  "areas",
  "resources",
  "questions",
  "archives",
] as const;

export function ensureNotesDir(): void {
  for (const sub of PARA_DIRS) {
    mkdirSync(resolve(settings.notesDir, sub), { recursive: true });
  }
}
