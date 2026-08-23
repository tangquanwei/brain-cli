import { runDaemon, stopDaemon, watcherStatus, isWatcherRunning, getWatcherPid } from "../watcher/daemon.js";
import { c, log, panel, table } from "../utils/ui.js";

export async function runWatchStart(): Promise<void> {
  if (isWatcherRunning()) {
    log(c.warn(`⚠️  Watcher 已在运行 (PID=${getWatcherPid()})`));
    return;
  }
  panel(
    `${c.bold("🤖 启动 Watcher 守护进程")}\n` +
      "自动提交并推送 notes，零摩擦运行\n" +
      "按 Ctrl+C 停止",
    { borderColor: "green" },
  );
  await runDaemon();
}

export async function runWatchStop(): Promise<void> {
  const ok = await stopDaemon();
  log(ok ? c.success("✅ Watcher 已停止") : c.warn("⚠️  Watcher 未在运行"));
}

export function runWatchStatus(): void {
  const info = watcherStatus();
  const rows: (string | number)[][] = [
    ["运行状态", info.running ? c.success("✅ 运行中") : c.error("❌ 未运行")],
  ];
  if (info.pid !== null) rows.push(["PID", info.pid]);
  rows.push(["Commit 间隔", `${info.commitInterval}s`]);
  rows.push(["Push 间隔", `${info.pushInterval}s`]);
  rows.push(["日志文件", info.logFile]);
  table({ title: "🤖 Watcher 状态", rows });

  if (info.lastLogs.length) {
    log(`\n${c.dim("最近日志:")}`);
    for (const line of info.lastLogs) log(`  ${c.dim(line)}`);
  }
}
