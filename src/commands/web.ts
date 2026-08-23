import { createWebServer } from "../web/server.js";
import { c, log, panel } from "../utils/ui.js";

export interface WebOptions {
  open: boolean;
  port: number;
}

export async function runWeb(opts: WebOptions): Promise<void> {
  panel(c.bold("🧠 2ndBrain WebUI"), { borderColor: "cyan" });
  const url = `http://127.0.0.1:${opts.port}`;
  const server = createWebServer(opts);
  server.on("listening", () => {
    log(`${c.success("✅ WebUI 已启动:")} ${c.bold(url)}`);
    log(c.dim("   仪表盘 / 笔记 / 回顾 / 链接健康 / 知识图谱 · Ctrl+C 停止"));
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    log(
      c.error(
        error.code === "EADDRINUSE"
          ? `❌ 端口 ${opts.port} 已被占用`
          : `❌ ${error.message}`,
      ),
    );
    process.exitCode = 1;
  });
  await new Promise<void>((resolveDone) => {
    const close = () => server.close(() => resolveDone());
    server.once("error", () => resolveDone());
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });
}
