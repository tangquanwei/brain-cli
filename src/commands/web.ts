import { createWebServer } from "../web/server.js";
import {
  isWebRunning,
  getWebPid,
  spawnWebDaemon,
  stopWebDaemon,
  webStatus,
  writePid,
  removePid,
  logLine,
} from "../web/daemon.js";
import { settings } from "../config.js";
import { c, log, panel, table } from "../utils/ui.js";

export interface WebOptions {
  open: boolean;
  port: number;
  daemon?: boolean;
  daemonChild?: boolean;
}

function displayHost(host: string): string {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

async function serveForeground(opts: WebOptions): Promise<void> {
  const host = settings.webHost;
  const url = `http://${displayHost(host)}:${opts.port}`;
  const server = createWebServer({ ...opts, host });
  server.on("listening", () => {
    const lines = [
      `${c.success("✅ WebUI 已启动:")} ${c.bold(url)}`,
      c.dim("   仪表盘 / 笔记 / 回顾 / 链接健康 / 知识图谱 · Ctrl+C 停止"),
    ];
    if (host === "0.0.0.0" || host === "::") {
      lines.push(
        c.warn(
          `   ⚠️  正在监听全部网卡（WEB_HOST=${host}），请确认已设置 WEB_TOKEN 且仅在组网/内网环境使用`,
        ),
      );
    } else if (!settings.webToken && opts.daemonChild) {
      // keep output minimal
    }
    if (opts.daemonChild) {
      logLine("INFO", `WebUI 已启动 ${url} host=${host}`);
    } else {
      for (const line of lines) log(line);
    }
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    const msg =
      error.code === "EADDRINUSE"
        ? `❌ 端口 ${opts.port} 已被占用`
        : `❌ ${error.message}`;
    if (opts.daemonChild) logLine("ERROR", msg);
    else log(c.error(msg));
    process.exitCode = 1;
  });
  await new Promise<void>((resolveDone) => {
    const close = () =>
      server.close(() => {
        if (opts.daemonChild) {
          removePid();
          logLine("INFO", "Web 守护进程已停止");
        }
        resolveDone();
      });
    server.once("error", () => resolveDone());
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });
}

export async function runWeb(opts: WebOptions): Promise<void> {
  if (opts.daemonChild) {
    // 守护进程子进程：写 PID、只记日志，不输出终端面板
    if (isWebRunning() && getWebPid() !== process.pid) {
      // spawnWebDaemon 已预先写入本进程 pid，这里直接覆盖为自己的 pid
    }
    writePid();
    await serveForeground(opts);
    return;
  }

  if (opts.daemon) {
    if (isWebRunning()) {
      log(c.warn(`⚠️  WebUI 已在运行 (PID=${getWebPid()})`));
      return;
    }
    panel(c.bold("🧠 2ndBrain WebUI 守护进程"), { borderColor: "cyan" });
    const pid = spawnWebDaemon({ port: opts.port });
    const url = `http://${displayHost(settings.webHost)}:${opts.port}`;
    log(`${c.success("✅ 已在后台启动:")} ${c.bold(url)} (PID=${pid})`);
    if (settings.webHost === "0.0.0.0" || settings.webHost === "::") {
      log(
        c.warn(
          `   ⚠️  监听全部网卡，请确认已设置 WEB_TOKEN（当前${settings.webToken ? "已设置" : "未设置！"}）`,
        ),
      );
    }
    log(c.dim(`   停止: brain web stop · 状态: brain web status`));
    return;
  }

  panel(c.bold("🧠 2ndBrain WebUI"), { borderColor: "cyan" });
  await serveForeground(opts);
}

export async function runWebStop(): Promise<void> {
  const ok = await stopWebDaemon();
  log(ok ? c.success("✅ WebUI 已停止") : c.warn("⚠️  WebUI 未在运行"));
}

export function runWebStatus(port: number): void {
  const info = webStatus(port);
  const rows: (string | number)[][] = [
    ["运行状态", info.running ? c.success("✅ 运行中") : c.error("❌ 未运行")],
  ];
  if (info.pid !== null) rows.push(["PID", info.pid]);
  rows.push(["监听地址", `${info.host}:${info.port}`]);
  rows.push(["鉴权 Token", settings.webToken ? "✅ 已设置" : c.warn("未设置")]);
  rows.push(["日志文件", info.logFile]);
  table({ title: "🧠 WebUI 状态", rows });

  if (info.lastLogs.length) {
    log(`\n${c.dim("最近日志:")}`);
    for (const line of info.lastLogs) log(`  ${c.dim(line)}`);
  }
}
