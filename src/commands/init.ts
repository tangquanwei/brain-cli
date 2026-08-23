import { mkdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { REPO_ROOT } from "../utils/paths.js";
import { PARA_DIRS, ensureNotesDir, settings } from "../config.js";
import { c, log, panel, table } from "../utils/ui.js";
import { existsSync } from "node:fs";

export function runInit(): void {
  panel(c.bold("🏗️ 初始化第二大脑目录"), { borderColor: "magenta" });

  ensureNotesDir();
  const templatesDir = resolve(REPO_ROOT, "templates");
  mkdirSync(templatesDir, { recursive: true });

  const dirs = [...PARA_DIRS.map((d) => resolve(settings.notesDir, d)), templatesDir];
  table({
    rows: dirs.map((d) => [c.success("✅"), relative(REPO_ROOT, d)]),
  });

  const envFile = resolve(REPO_ROOT, ".env");
  if (!existsSync(envFile)) {
    log(`\n${c.warn("⚠️  .env 文件不存在")}`);
  } else {
    log(`\n${c.success("✅ .env 文件已存在")}`);
  }

  log(`\n${c.bold(c.success("🎉 初始化完成！"))}`);
  log(c.dim("使用 `brain --help` 查看所有命令"));
}
