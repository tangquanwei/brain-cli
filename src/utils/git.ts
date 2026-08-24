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
export async function autoCommit(message?: string, force = false): Promise<boolean> {
  if (!settings.gitAutoCommit && !force) return false;
  if (!(await isNotesRepo())) {
    log(`  ${c.error("❌ notes 目录不是 Git 仓库，无法备份")}`);
    return false;
  }

  const git = notesGit();
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
