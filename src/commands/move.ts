import { existsSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { settings } from "../config.js";
import {
  applyNoteMovePlan,
  buildNoteMovePlan,
  formatPlanPath,
  resolveNewNotePath,
} from "../utils/rewriteLinks.js";
import { c, log, panel } from "../utils/ui.js";

export interface MoveOptions {
  dryRun: boolean;
}

function isInsideVault(path: string): boolean {
  const rel = relative(settings.notesDir, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export async function runMove(
  oldArg: string,
  newArg: string,
  opts: MoveOptions,
): Promise<void> {
  const fromCwd = resolve(process.cwd(), oldArg);
  const fromVault = resolve(settings.notesDir, oldArg);
  const oldPath = existsSync(fromCwd) ? fromCwd : fromVault;
  if (!existsSync(oldPath)) {
    log(c.error(`❌ 文件不存在: ${oldPath}`));
    process.exit(1);
  }
  if (!isInsideVault(oldPath)) {
    throw new Error(`源文件不在知识库目录内: ${oldPath}`);
  }

  const newPath = resolveNewNotePath(oldPath, newArg);
  if (!isInsideVault(newPath)) {
    throw new Error(`目标文件不在知识库目录内: ${newPath}`);
  }
  if (oldPath === newPath) {
    log(c.warn("⚠️  新旧路径相同，无需操作"));
    return;
  }
  if (existsSync(newPath)) {
    log(c.error(`❌ 目标文件已存在: ${newPath}`));
    process.exit(1);
  }

  const plan = buildNoteMovePlan(oldPath, newPath);
  const prefix = opts.dryRun ? "[DRY RUN] " : "";
  panel(`${c.bold(`${prefix}移动笔记`)}`, { borderColor: "yellow" });
  log(`  ${c.dim("文件")}  ${formatPlanPath(plan.oldPath)}`);
  log(`      ${c.success("→")}  ${formatPlanPath(plan.newPath)}`);
  log(`  ${c.dim("目录")}  ${formatPlanPath(dirname(plan.newPath))}`);

  for (const asset of plan.assetMoves) {
    log(`  ${c.dim("附件")}  ${formatPlanPath(asset.old)}`);
    log(`      ${c.success("→")}  ${formatPlanPath(asset.new)}`);
  }
  if (plan.linkRewrites.length > 0) {
    log(`  ${c.dim("链接")}  将更新 ${plan.linkRewrites.length} 处引用`);
  }

  if (opts.dryRun) return;

  applyNoteMovePlan(plan);
  log(
    c.success(
      `✓ 移动完成: ${formatPlanPath(plan.oldPath)} → ${formatPlanPath(plan.newPath)}`,
    ),
  );
}
