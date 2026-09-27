import { simpleGit, type SimpleGit } from "simple-git";
import { REPO_ROOT } from "./paths.js";
import { settings } from "../config.js";
import { c, log } from "./ui.js";

const parentGit: SimpleGit = simpleGit(REPO_ROOT);

function notesGit(): SimpleGit {
  return simpleGit(settings.notesDir);
}

async function checkRepo(git: SimpleGit): Promise<boolean> {
  try {
    if (!(await git.checkIsRepo())) return false;
    // Ask Git whether its working directory is the repository root. Comparing
    // --show-toplevel with a Node path is unreliable on Windows because Git can
    // expand an 8.3 path such as RUNNER~1 to its long form.
    const prefix = await git.raw(["rev-parse", "--show-prefix"]);
    return prefix.trim() === "";
  } catch {
    return false;
  }
}

export async function isNotesRepo(): Promise<boolean> {
  // simple-git/Git searches parent directories. Require the discovered
  // worktree root to be exactly notes/, otherwise an uninitialized notes
  // directory could accidentally run Git commands against Brain itself.
  return checkRepo(notesGit());
}

export async function isRepo(): Promise<boolean> {
  return checkRepo(parentGit);
}

export async function ensureRepo(): Promise<boolean> {
  if (await isRepo()) return true;
  try {
    await parentGit.init();
    log(`  ${c.success("✅ Git 仓库已初始化")}`);
    return true;
  } catch (e) {
    log(`  ${c.error(`❌ Git 初始化失败: ${(e as Error).message}`)}`);
    return false;
  }
}

async function statusShortFor(git: SimpleGit, ignoreSubmoduleDirty = false): Promise<string> {
  const args = ["status", "--short"];
  if (ignoreSubmoduleDirty) args.push("--ignore-submodules=dirty");
  const r = await git.raw(args);
  return r.trim();
}

export async function statusShort(): Promise<string> {
  if (!(await isRepo())) return "";
  return statusShortFor(parentGit);
}

export async function parentStatusShort(): Promise<string> {
  if (!(await isRepo())) return "";
  return statusShortFor(parentGit, true);
}

export async function notesStatusShort(): Promise<string> {
  if (!(await isNotesRepo())) return "";
  return statusShortFor(notesGit());
}

async function currentBranchFor(git: SimpleGit): Promise<string> {
  const r = await git.raw(["branch", "--show-current"]);
  return r.trim() || "main";
}

export async function currentBranch(): Promise<string> {
  return currentBranchFor(notesGit());
}

async function hasRemoteFor(git: SimpleGit): Promise<boolean> {
  const r = await git.raw(["remote"]);
  return r.trim().length > 0;
}

export async function hasRemote(): Promise<boolean> {
  if (!(await isNotesRepo())) return false;
  return hasRemoteFor(notesGit());
}

function autoMessage(fileCount: number): string {
  const tzOffsetMs = 8 * 60 * 60 * 1000;
  const localTime = new Date(Date.now() + tzOffsetMs);
  const ts = localTime.toISOString().replace("T", " ").slice(0, 19);
  return `🧠 auto-backup: ${fileCount} files @ ${ts}`;
}

async function commitChanges(
  git: SimpleGit,
  label: string,
  status: string,
  message?: string,
): Promise<boolean> {
  if (!status) return false;

  const fileCount = status.split("\n").filter(Boolean).length;
  log(`  ${c.dim(`${label}: 检测到 ${fileCount} 个变更文件`)}`);

  try {
    await git.add(["-A"]);
  } catch (e) {
    log(`  ${c.error(`❌ ${label} git add 失败: ${(e as Error).message}`)}`);
    return false;
  }

  const msg = message || autoMessage(fileCount);
  try {
    await git.commit(msg);
    log(`  ${c.success(`✅ ${label} 已提交:`)} ${msg}`);
    return true;
  } catch (e) {
    const err = (e as Error).message;
    if (err.includes("nothing to commit")) return false;
    log(`  ${c.error(`❌ ${label} git commit 失败: ${err}`)}`);
    return false;
  }
}

/**
 * Add and commit changes inside the notes repository only.
 *
 * The Brain control repository (and therefore its notes/blog submodule
 * pointers) is intentionally outside this automation boundary. It must be
 * versioned independently.
 *
 * Returns true if a notes commit was actually made. Honors
 * `settings.gitAutoCommit` unless `force = true`.
 */
export async function autoCommit(message?: string, force = false, notesDir = settings.notesDir): Promise<boolean> {
  if (!settings.gitAutoCommit && !force) return false;
  const git = simpleGit(notesDir);
  if (!(await checkRepo(git))) {
    log(`  ${c.error("❌ notes 目录不是 Git 仓库，无法备份")}`);
    return false;
  }

  const noteStatus = await statusShortFor(git);
  return commitChanges(git, "notes", noteStatus, message);
}

async function pushRepo(
  git: SimpleGit,
  label: string,
  remote = "origin",
  branch?: string,
): Promise<boolean> {
  if (!(await hasRemoteFor(git))) {
    log(`  ${c.warn(`${label}: 未配置远程仓库，跳过推送`)}`);
    return true;
  }

  const br = branch ?? (await currentBranchFor(git));
  log(`  ${c.info(`📤 ${label}: 推送到 ${remote}/${br}...`)}`);
  try {
    await git.push(remote, br);
    log(`  ${c.success(`✅ ${label}: 已推送到 ${remote}/${br}`)}`);
    return true;
  } catch (e) {
    log(`  ${c.error(`❌ ${label}: 推送失败: ${(e as Error).message}`)}`);
    return false;
  }
}

export async function push(remote = "origin", branch?: string): Promise<boolean> {
  if (!(await isNotesRepo())) {
    log(`  ${c.error("❌ notes 目录不是 Git 仓库，无法推送")}`);
    return false;
  }

  return pushRepo(notesGit(), "notes", remote, branch);
}

export interface PullResult {
  ok: boolean;
  /** 发生冲突或错误时的人工可读说明 */
  message?: string;
  /** 冲突时本地提交被备份到的分支名 */
  backupBranch?: string;
}

/**
 * 定时同步（watcher）：git pull --rebase。
 *
 * 冲突策略是“绝不覆盖任何一端”：
 * rebase 失败时回退（--abort），然后把本地未推送的提交推到
 * backup/conflict-<主机>-<时间戳> 分支，交由人工合衹。
 */
export async function pullRebase(): Promise<PullResult> {
  if (!(await isNotesRepo())) return { ok: false, message: "notes 不是 Git 仓库" };
  const git = notesGit();
  if (!(await hasRemoteFor(git))) return { ok: false, message: "未配置远程仓库" };

  // 工作区有未提交变更时先自动提交，避免 rebase 被脏工作区阻塞
  const dirty = await statusShortFor(git);
  if (dirty) {
    try {
      await git.add(["-A"]);
      await git.commit(autoMessage(dirty.split("\n").filter(Boolean).length));
    } catch (e) {
      return { ok: false, message: `拉取前自动提交失败: ${(e as Error).message}` };
    }
  }

  try {
    await git.raw(["pull", "--rebase", "origin"]);
    return { ok: true };
  } catch (e) {
    const err = (e as Error).message;
    // rebase 冲突：回退到 rebase 前状态
    try {
      await git.raw(["rebase", "--abort"]);
    } catch {
      // rebase 可能已完成或不在进行中，忽略
    }
    // 本地领先远程的提交推到备份分支，绝不丢失
    let backupBranch: string | undefined;
    try {
      const host = process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "device";
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      backupBranch = `backup/conflict-${host}-${ts}`;
      const branch = await currentBranchFor(git);
      await git.push("origin", `${branch}:refs/heads/${backupBranch}`);
      // 强制对齐远程，本地差异已在上一步备份
      await git.raw(["fetch", "origin", branch]);
      await git.raw(["reset", "--hard", `origin/${branch}`]);
    } catch (backupErr) {
      return {
        ok: false,
        message: `rebase 冲突且备份失败: ${(backupErr as Error).message}（原始错误: ${err}）`,
      };
    }
    return {
      ok: false,
      backupBranch,
      message: `rebase 冲突，本地提交已备份到 ${backupBranch}，本机已对齐远程。请人工合衹备份分支。`,
    };
  }
}

export async function backup(message?: string, doPush = false): Promise<void> {
  if (!(await isNotesRepo())) {
    log(`  ${c.error("❌ notes 目录不是 Git 仓库，无法备份")}`);
    return;
  }

  const committed = await autoCommit(message, true);
  if (!committed) {
    log(`  ${c.warn("没有需要备份的变更。")}`);
  }

  if (doPush) await push();
}
