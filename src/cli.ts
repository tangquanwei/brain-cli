import { Command } from "commander";
import { readFileSync } from "node:fs";
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
import { runDoctor } from "./commands/doctor.js";
import { configureVault } from "./config.js";
import { panel, c, log } from "./utils/ui.js";

function packageVersion(): string {
  const packageJson = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(readFileSync(packageJson, "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
}

const program = new Command();
program
  .name("brain")
  .description("🧠 Markdown 知识库安全维护工具")
  .version(packageVersion())
  .option("--vault <path>", "显式指定 Markdown 知识库目录");

program.hook("preAction", (rootCommand) => {
  const opts = rootCommand.opts<{ vault?: string }>();
  if (opts.vault) configureVault(opts.vault);
});

program
  .command("init")
  .description("[写入] 初始化知识库目录结构")
  .action(runInit);

program
  .command("status")
  .description("[只读] 查看知识库和 Git 状态")
  .action(runStatus);

program
  .command("doctor [path]")
  .description("[只读] 体检已有 Markdown 目录，无需初始化或迁移")
  .option("--json", "输出 JSON 结果", false)
  .action(async (path: string | undefined, opts: { json: boolean }) => {
    if (path) configureVault(path);
    await runDoctor(opts);
  });

program
  .command("capture <title>")
  .alias("new")
  .description("[写入] 快速本地捕获想法")
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
  .description("[Git 写入] 仅备份知识库 Git 仓库")
  .option("-m, --message <msg>", "提交信息", "")
  .option("--push", "同时推送 notes 到远程仓库", false)
  .action(async (opts: { message: string; push: boolean }) => {
    await runBackup(opts.message || undefined, opts.push);
  });

const watch = program.command("watch").description("[混合] 后台守护进程管理");
watch
  .command("start")
  .description("[持续写入] 启动 watcher 守护进程")
  .action(runWatchStart);
watch
  .command("stop")
  .description("[进程控制] 停止 watcher 守护进程")
  .action(runWatchStop);
watch
  .command("status")
  .description("[只读] 查看 watcher 运行状态")
  .action(runWatchStatus);

const review = program.command("review").description("[只读] 笔记回顾");
review.command("week").description("[只读] 回顾本周笔记").action(runReviewWeek);
review
  .command("month")
  .description("[只读] 回顾本月笔记")
  .action(runReviewMonth);
review
  .command("tags <tags>")
  .description("[只读] 按标签回顾 (逗号分隔)")
  .action((tagsArg: string) => runReviewTags(tagsArg));
review
  .command("random [n]")
  .description("[只读] 随机抽取 N 篇笔记复习")
  .action((n?: string) => runReviewRandom(parseInt(n ?? "5", 10) || 5));

program
  .command("rename <old-path> <new-name>")
  .description("[写入；--dry-run 只读] 重命名笔记并同步图片和链接")
  .option("--dry-run", "预览操作，不实际执行", false)
  .action(
    async (oldPath: string, newName: string, opts: { dryRun: boolean }) => {
      await runRename(oldPath, newName, { dryRun: opts.dryRun });
    },
  );

program
  .command("move <old-path> <new-path>")
  .description("[写入；--dry-run 只读] 移动笔记并重写链接")
  .option("--dry-run", "预览操作，不实际执行", false)
  .action(
    async (oldPath: string, newPath: string, opts: { dryRun: boolean }) => {
      await runMove(oldPath, newPath, { dryRun: opts.dryRun });
    },
  );

program
  .command("links")
  .description("[默认只读；--write 写入] 检查 Markdown、WikiLink 和嵌入")
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
  .description("[只读] 查看某篇笔记的反向链接")
  .action(async (note: string) => {
    await runBacklinks(note);
  });

program
  .command("web")
  .description("[混合] 启动本地 WebUI（浏览只读，编辑操作写入）")
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
