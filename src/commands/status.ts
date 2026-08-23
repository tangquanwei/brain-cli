import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PARA_DIRS, settings } from "../config.js";
import { isNotesRepo, isRepo, notesStatusShort, parentStatusShort } from "../utils/git.js";
import { countMdRecursive } from "../web/data.js";
import { c, log, panel, table } from "../utils/ui.js";

const ICONS: Record<string, string> = {
  projects: "📁",
  areas: "🎯",
  resources: "📚",
  archives: "📦",
};

export async function runStatus(): Promise<void> {
  panel(c.bold("📊 第二大脑状态"), { borderColor: "cyan" });

  const gitOk = await isRepo();
  const notesGitOk = await isNotesRepo();
  table({
    title: "配置信息",
    rows: [
      ["笔记目录", settings.notesDir],
      ["notes 自动提交", settings.gitAutoCommit ? "✅" : "❌"],
      ["notes 备份仓库", notesGitOk ? "✅" : "❌ 未初始化"],
      ["Brain 总控仓库", gitOk ? "✅ 独立管理" : "❌ 未初始化"],
      ["备份边界", "brain backup 仅管理 notes"],
      ["Commit 间隔", `${settings.commitInterval}s`],
      ["Push 间隔", `${settings.pushInterval}s`],
    ],
  });

  let total = 0;
  const rows: (string | number)[][] = [];
  for (const sub of PARA_DIRS) {
    const base = resolve(settings.notesDir, sub);
    const n = countMdRecursive(base);
    rows.push([`${ICONS[sub] ?? "📄"} ${sub}`, n]);
    total += n;
    if (existsSync(base)) {
      const children = readdirSync(base, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const child of children) {
        const cn = countMdRecursive(resolve(base, child.name));
        if (cn > 0) rows.push([`   └─ ${child.name}`, cn]);
      }
    }
  }
  rows.push([c.bold("合计"), c.bold(String(total))]);
  table({ title: "\n本地笔记统计", rows });

  log("");
  if (notesGitOk) {
    const notesChanges = await notesStatusShort();
    if (notesChanges) {
      const n = notesChanges.split("\n").filter(Boolean).length;
      log(c.warn(`📝 notes 待备份: ${n} 个文件变更`));
    } else {
      log(c.success("✅ notes 工作区干净"));
    }
  } else {
    log(c.warn("⚠️ notes 不是 Git 仓库，brain backup 不可用"));
  }

  if (gitOk) {
    const parentChanges = await parentStatusShort();
    if (parentChanges) {
      const n = parentChanges.split("\n").filter(Boolean).length;
      log(c.warn(`📝 Brain 总控仓库待提交: ${n} 个文件变更（需独立处理）`));
    } else {
      log(c.success("✅ Brain 总控仓库工作区干净（独立管理）"));
    }
  }
}
