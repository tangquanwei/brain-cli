import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { settings } from "../src/config.js";
import { runCapture } from "../src/commands/capture.js";
import { autoCommit, backup, isNotesRepo } from "../src/utils/git.js";
import { REPO_ROOT } from "../src/utils/paths.js";

const originalNotesDir = settings.notesDir;
const tempDirs: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function makeRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  git(dir, "init", "-b", "main");
  git(dir, "config", "user.name", "brain-cli tests");
  git(dir, "config", "user.email", "brain-cli-tests@example.invalid");
  return dir;
}

function seedRepo(prefix = "brain-cli-notes-"): string {
  const dir = makeRepo(prefix);
  writeFileSync(join(dir, "README.md"), "temporary notes repository\n", "utf8");
  git(dir, "add", "-A");
  git(dir, "commit", "-m", "initial notes");
  return dir;
}

function rootGitSnapshot(): {
  head: string;
  blogStatus: string;
  submoduleStatus: string;
  index: string;
} {
  return {
    head: git(REPO_ROOT, "rev-parse", "HEAD"),
    blogStatus: git(REPO_ROOT, "status", "--short", "--untracked-files=all", "--", "blog"),
    submoduleStatus: git(REPO_ROOT, "status", "--short", "--", "blog", "notes"),
    // A notes-only operation must not leave any Brain control-repository
    // paths staged, including a submodule pointer.
    index: git(REPO_ROOT, "diff", "--cached", "--name-only"),
  };
}

afterEach(() => {
  settings.notesDir = originalNotesDir;
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe.sequential("notes-only Git boundary", () => {
  it("autoCommit commits notes changes without changing the Brain root or blog", async () => {
    const notesDir = seedRepo();
    settings.notesDir = notesDir;
    const before = rootGitSnapshot();

    mkdirSync(join(notesDir, "projects"), { recursive: true });
    writeFileSync(join(notesDir, "projects", "idea.md"), "# Temporary idea\n", "utf8");
    // The parent repository and its blog submodule are deliberately not part
    // of the fixture. This assertion proves the operation does not even stage
    // their existing worktree state.
    expect(await autoCommit("notes-only test", true)).toBe(true);

    expect(git(notesDir, "log", "-1", "--pretty=%s")).toBe("notes-only test");
    expect(git(notesDir, "status", "--short")).toBe("");
    expect(rootGitSnapshot()).toEqual(before);
  });

  it("backup reports no work and does not commit when notes are clean", async () => {
    const notesDir = seedRepo();
    settings.notesDir = notesDir;
    const beforeCount = git(notesDir, "rev-list", "--count", "HEAD");
    const beforeRoot = rootGitSnapshot();

    await backup("must not be used");

    expect(git(notesDir, "rev-list", "--count", "HEAD")).toBe(beforeCount);
    expect(rootGitSnapshot()).toEqual(beforeRoot);
  });

  it("rejects a plain notes directory instead of falling back to the Brain root", async () => {
    const plainNotesDir = mkdtempSync(join(REPO_ROOT, ".brain-cli-test-notes-"));
    tempDirs.push(plainNotesDir);
    settings.notesDir = plainNotesDir;
    const beforeRoot = rootGitSnapshot();

    expect(await isNotesRepo()).toBe(false);
    expect(await autoCommit("must not touch Brain", true)).toBe(false);
    expect(rootGitSnapshot()).toEqual(beforeRoot);
  });

  it("capture auto-commits the temporary notes repository, never the Brain root", async () => {
    const notesDir = seedRepo();
    settings.notesDir = notesDir;
    const beforeRoot = rootGitSnapshot();

    const filepath = await runCapture({
      title: "Boundary capture",
      content: "This is isolated to notes.",
      type: "Project",
    });

    expect(filepath).toBe(join(notesDir, "projects", "Boundary capture.md"));
    expect(git(notesDir, "log", "-1", "--pretty=%s")).toBe(
      "🧠 capture: Boundary capture",
    );
    expect(rootGitSnapshot()).toEqual(beforeRoot);
  });

  it("backup --push publishes only the notes repository", async () => {
    const notesDir = seedRepo();
    const remoteDir = mkdtempSync(join(tmpdir(), "brain-cli-notes-remote-"));
    tempDirs.push(remoteDir);
    git(remoteDir, "init", "--bare", "--initial-branch=main");
    git(notesDir, "remote", "add", "origin", remoteDir);
    settings.notesDir = notesDir;
    const beforeRoot = rootGitSnapshot();

    mkdirSync(join(notesDir, "areas"), { recursive: true });
    writeFileSync(join(notesDir, "areas", "remote.md"), "# Remote test\n", "utf8");
    await backup("notes-only push test", true);

    const localHead = git(notesDir, "rev-parse", "HEAD");
    expect(git(remoteDir, "rev-parse", "refs/heads/main")).toBe(localHead);
    expect(git(notesDir, "status", "--short")).toBe("");
    expect(rootGitSnapshot()).toEqual(beforeRoot);
  });
});
