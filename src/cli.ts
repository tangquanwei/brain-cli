import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runCapture, type NoteType } from "./commands/capture.js";
import { runBackup } from "./commands/backup.js";
import {
  runReviewWeek,
  runReviewMonth,
  runReviewTags,
  runReviewRandom,
} from "./commands/review.js";
import {
  runWatchStart,
  runWatchStop,
  runWatchStatus,
} from "./commands/watch.js";
import { runRename } from "./commands/rename.js";
import { runWeb } from "./commands/web.js";
import { runLinks } from "./commands/links.js";
import { runBacklinks } from "./commands/backlinks.js";
import { runMove } from "./commands/move.js";
import { panel, c, log } from "./utils/ui.js";

const program = new Command();
program.name("brain").description("🧠 2nd Brain v2").version("0.1.0");

program
  .command("init")
  .description("🏗️ 初始化第二大脑目录结构")
  .action(runInit);

program.command("status").description("📊 查看第二大脑状态").action(runStatus);

program
  .command("capture <title>")
  .alias("new")
  .description("💡 快速本地捕获想法")
  .option("-c, --content <text>", "笔记正文内容", "")
  .option("-t, --tags <tags>", "标签（逗号分隔）", "")
  .option(
    "--type <type>",
    "笔记类型 (Fleeting | Literature | Permanent | Project)",
    "Fleeting",
  )
  .action(
    async (
      title: string,
      opts: { content: string; tags: string; type: string },
    ) => {
      const tags = opts.tags
        ? opts.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      const allowed: NoteType[] = [
        "Fleeting",
        "Literature",
        "Permanent",
        "Project",
      ];
      const type = (
        allowed.includes(opts.type as NoteType) ? opts.type : "Fleeting"
      ) as NoteType;
      panel(`${c.bold("💡 捕获笔记")}\n标题: ${title}`, {
        borderColor: "cyan",
      });
      await runCapture({ title, content: opts.content, tags, type });
    },
  );

program
  .command("backup")
  .description("💾 仅备份 notes Git 仓库")
  .option("-m, --message <msg>", "提交信息", "")
  .option("--push", "同时推送 notes 到远程仓库", false)
  .action(async (opts: { message: string; push: boolean }) => {
    await runBackup(opts.message || undefined, opts.push);
  });

const watch = program.command("watch").description("🤖 后台守护进程管理");
watch
  .command("start")
  .description("启动 watcher 守护进程")
  .action(runWatchStart);
watch.command("stop").description("停止 watcher 守护进程").action(runWatchStop);
watch
  .command("status")
  .description("查看 watcher 运行状态")
  .action(runWatchStatus);

const review = program.command("review").description("📚 笔记回顾");
review.command("week").description("📅 回顾本周笔记").action(runReviewWeek);
review.command("month").description("📅 回顾本月笔记").action(runReviewMonth);
review
  .command("tags <tags>")
  .description("🏷️  按标签回顾 (逗号分隔)")
  .action((tagsArg: string) => runReviewTags(tagsArg));
review
  .command("random [n]")
  .description("🎲 随机抽取 N 篇笔记复习")
  .action((n?: string) => runReviewRandom(parseInt(n ?? "5", 10) || 5));

program
  .command("rename <old-path> <new-name>")
  .description("✏️  重命名笔记文件（自动同步图片目录和链接）")
  .option("--dry-run", "预览操作，不实际执行", false)
  .action(
    async (oldPath: string, newName: string, opts: { dryRun: boolean }) => {
      await runRename(oldPath, newName, { dryRun: opts.dryRun });
    },
  );

program
  .command("move <old-path> <new-path>")
  .description("🚚 移动笔记文件（自动重写相对链接）")
  .option("--dry-run", "预览操作，不实际执行", false)
  .action(
    async (oldPath: string, newPath: string, opts: { dryRun: boolean }) => {
      await runMove(oldPath, newPath, { dryRun: opts.dryRun });
    },
  );

program
  .command("links")
  .description("🔗 检查 notes 中的标准 Markdown 链接")
  .option("--check", "发现断链或缺失标题时返回非零状态码", false)
  .option("--json", "输出完整链接图 JSON", false)
  .option("--orphans", "列出孤岛笔记", false)
  .option("--stats", "按 PARA 区域输出孤岛统计", false)
  .option("--scope <scope>", "孤岛范围 (active | all)", "all")
  .option("--write", "写入 notes/.brain/links.json", false)
  .action(
    async (opts: {
      check: boolean;
      json: boolean;
      orphans: boolean;
      stats: boolean;
      scope: string;
      write: boolean;
    }) => {
      if (!["active", "all"].includes(opts.scope)) {
        throw new Error("--scope 只支持 active 或 all");
      }
      await runLinks({ ...opts, scope: opts.scope as "active" | "all" });
    },
  );

program
  .command("backlinks <note>")
  .description("↩️  查看某篇笔记的反向链接")
  .action(async (note: string) => {
    await runBacklinks(note);
  });

program
  .command("web")
  .description("🌐 启动统一 WebUI（仪表盘/笔记/回顾/链接/图谱）")
  .option("--open", "启动后自动在浏览器中打开", false)
  .option("-p, --port <number>", "监听端口", "3739")
  .action(async (opts: { open: boolean; port: string }) => {
    await runWeb({
      open: opts.open,
      port: parseInt(opts.port, 10) || 3739,
    });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  log(c.error(`❌ ${(err as Error).message}`));
  process.exit(1);
});
