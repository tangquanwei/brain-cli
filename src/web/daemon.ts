import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { REPO_ROOT } from "../utils/paths.js";
import { settings } from "../config.js";

const LOG_DIR = resolve(REPO_ROOT, "logs");
export const WEB_LOG_FILE = resolve(LOG_DIR, "web.log");
export const WEB_PID_FILE = resolve(REPO_ROOT, ".web.pid");

function ensureLogDir(): void {
  mkdirSync(LOG_DIR, { recursive: true });
}

export function logLine(level: "INFO" | "WARN" | "ERROR", msg: string): void {
  ensureLogDir();
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  appendFileSync(WEB_LOG_FILE, `${ts} [${level}] ${msg}\n`, "utf-8");
}

export function writePid(): void {
  writeFileSync(WEB_PID_FILE, String(process.pid), "utf-8");
}

export function removePid(): void {
  try {
    if (existsSync(WEB_PID_FILE)) unlinkSync(WEB_PID_FILE);
  } catch {
    // ignore
  }
}

export function getWebPid(cleanupStale = true): number | null {
  if (!existsSync(WEB_PID_FILE)) return null;
  let pid: number;
  try {
    pid = parseInt(readFileSync(WEB_PID_FILE, "utf-8").trim(), 10);
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

export function isWebRunning(): boolean {
  return getWebPid() !== null;
}

export interface SpawnDaemonArgs {
  port: number;
}

/**
 * 以 detached 子进程方式后台启动 WebUI。
 * 子进程通过 BRAIN_WEB_DAEMON_CHILD=1 识别守护身份（见 cli.ts），
 * 自行写 PID 并运行 runWeb；日志重定向到 logs/web.log。
 */
export function spawnWebDaemon(args: SpawnDaemonArgs): number {
  ensureLogDir();
  const out = openSync(WEB_LOG_FILE, "a");
  const cliEntry = process.argv[1];
  if (!cliEntry) throw new Error("无法定位 CLI 入口，守护进程启动失败");
  const child = spawn(
    process.execPath,
    [cliEntry, "web", "--daemon-child", "--port", String(args.port)],
    {
      detached: true,
      stdio: ["ignore", out, out],
      env: {
        ...process.env,
        BRAIN_WEB_DAEMON_CHILD: "1",
        NOTES_DIR: settings.notesDir,
      },
    },
  );
  child.unref();
  if (typeof child.pid === "number") writeFileSync(WEB_PID_FILE, String(child.pid), "utf-8");
  logLine("INFO", `🚀 Web 守护进程已派生 (PID=${child.pid ?? "?"}) port=${args.port}`);
  return child.pid ?? -1;
}

export async function stopWebDaemon(): Promise<boolean> {
  const pid = getWebPid();
  if (pid === null) return false;
  try {
    if (process.platform === "win32") {
      const { spawnSync } = await import("node:child_process");
      spawnSync("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
    removePid();
    logLine("INFO", `已停止 Web (PID=${pid})`);
    return true;
  } catch {
    removePid();
    return false;
  }
}

export interface WebStatus {
  running: boolean;
  pid: number | null;
  logFile: string;
  host: string;
  port: number;
  lastLogs: string[];
}

export function webStatus(port: number): WebStatus {
  const pid = getWebPid(false);
  let lastLogs: string[] = [];
  if (existsSync(WEB_LOG_FILE)) {
    try {
      const lines = readFileSync(WEB_LOG_FILE, "utf-8").trim().split("\n");
      lastLogs = lines.slice(-5);
    } catch {
      // ignore
    }
  }
  return {
    running: pid !== null,
    pid,
    logFile: WEB_LOG_FILE,
    host: settings.webHost,
    port,
    lastLogs,
  };
}
