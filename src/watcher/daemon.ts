import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../utils/paths.js";
import { settings, ensureNotesDir } from "../config.js";
import { ChangeDetector } from "./detector.js";
import { autoCommit, hasRemote, isNotesRepo, push } from "../utils/git.js";

const LOG_DIR = resolve(REPO_ROOT, "logs");
const LOG_FILE = resolve(LOG_DIR, "watcher.log");
export const PID_FILE = resolve(REPO_ROOT, ".watcher.pid");

function ensureLogDir(): void {
  mkdirSync(LOG_DIR, { recursive: true });
}

function logLine(level: "INFO" | "WARN" | "ERROR", msg: string): void {
  ensureLogDir();
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  appendFileSync(LOG_FILE, `${ts} [${level}] ${msg}\n`, "utf-8");
}

function writePid(): void {
  writeFileSync(PID_FILE, String(process.pid), "utf-8");
}

function removePid(): void {
  try {
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
}

export function getWatcherPid(cleanupStale = true): number | null {
  if (!existsSync(PID_FILE)) return null;
  let pid: number;
  try {
    pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
  } catch {
    return null;
  }
  if (!Number.isFinite(pid)) return null;
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return pid;
  } catch {
    if (cleanupStale) removePid();
    return null;
  }
}

export function isWatcherRunning(): boolean {
  return getWatcherPid() !== null;
}

export async function runDaemon(): Promise<void> {
  if (isWatcherRunning()) {
    logLine("WARN", `Watcher 已在运行 (PID=${getWatcherPid()})，跳过`);
    return;
  }

  ensureNotesDir();
  writePid();
  logLine(
    "INFO",
    `🚀 Watcher 启动 (PID=${process.pid}) commit=${settings.commitInterval}s push=${settings.pushInterval}s`,
  );

  const detector = new ChangeDetector(settings.notesDir);
  detector.start();

  let stopRequested = false;
  let lastCommit = Date.now();
  let lastPush = Date.now();

  const doCommit = async () => {
    const changed = detector.flush();
    if (!changed.length) return;
    if (!(await isNotesRepo())) return;
    logLine("INFO", `检测到 ${changed.length} 个文件变化，自动提交`);
    const original = settings.gitAutoCommit;
    settings.gitAutoCommit = true;
    try {
      await autoCommit(`🤖 auto: ${changed.length} files changed`);
    } catch (e) {
      logLine("ERROR", `[commit] ${(e as Error).message}`);
    } finally {
      settings.gitAutoCommit = original;
    }
  };

  const doPush = async () => {
    if (!(await isNotesRepo())) return;
    if (!(await hasRemote())) return;
    try {
      const ok = await push();
      if (ok) logLine("INFO", "已推送到远程仓库");
    } catch (e) {
      logLine("ERROR", `[push] ${(e as Error).message}`);
    }
  };

  const onSignal = (sig: NodeJS.Signals) => {
    logLine("INFO", `收到 ${sig}，正在退出...`);
    stopRequested = true;
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    while (!stopRequested) {
      const now = Date.now();
      if (
        settings.commitInterval > 0 &&
        now - lastCommit >= settings.commitInterval * 1000
      ) {
        await doCommit();
        lastCommit = Date.now();
      }
      if (
        settings.pushInterval > 0 &&
        now - lastPush >= settings.pushInterval * 1000
      ) {
        await doPush();
        lastPush = Date.now();
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
  } finally {
    await detector.stop();
    removePid();
    logLine("INFO", "Watcher 已停止");
  }
}

export async function stopDaemon(): Promise<boolean> {
  const pid = getWatcherPid();
  if (pid === null) return false;
  try {
    if (process.platform === "win32") {
      const { spawnSync } = await import("node:child_process");
      spawnSync("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    removePid();
    logLine("INFO", `已停止 Watcher (PID=${pid})`);
    return true;
  } catch {
    removePid();
    return false;
  }
}

export interface WatcherStatus {
  running: boolean;
  pid: number | null;
  logFile: string;
  commitInterval: number;
  pushInterval: number;
  lastLogs: string[];
}

export function watcherStatus(): WatcherStatus {
  const pid = getWatcherPid(false);
  let lastLogs: string[] = [];
  if (existsSync(LOG_FILE)) {
    try {
      const lines = readFileSync(LOG_FILE, "utf-8").trim().split("\n");
      lastLogs = lines.slice(-5);
    } catch {
      // ignore
    }
  }
  return {
    running: pid !== null,
    pid,
    logFile: LOG_FILE,
    commitInterval: settings.commitInterval,
    pushInterval: settings.pushInterval,
    lastLogs,
  };
}
