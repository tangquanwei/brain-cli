import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// brain-cli 既可以作为 2ndBrain 主仓库的子目录（仓库根 = 主仓库根），
// 也可以作为独立开源仓库（仓库根 = brain-cli 自身）。
// 两阶段向上探测：先找包含 brain-cli/ 子目录的主仓库根，再找 brain-cli 自身。
import { existsSync, readFileSync } from "node:fs";

function isBrainCliPkg(dir: string): boolean {
  const pkg = resolve(dir, "package.json");
  if (!existsSync(pkg)) return false;
  try {
    const data = JSON.parse(readFileSync(pkg, "utf-8")) as { name?: string };
    return data.name === "brain-cli";
  } catch {
    return false;
  }
}

function findRepoRoot(): string {
  // Start from this file's directory and walk up.
  const here = dirname(fileURLToPath(import.meta.url));
  // 阶段一：主仓库模式 —— 某级目录下存在 brain-cli/package.json
  let dir = here;
  for (let i = 0; i < 10; i++) {
    if (isBrainCliPkg(resolve(dir, "brain-cli"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 阶段二：独立仓库模式 —— brain-cli 自身就是仓库根
  dir = here;
  for (let i = 0; i < 10; i++) {
    if (isBrainCliPkg(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume cwd is repo root.
  return process.cwd();
}

export const REPO_ROOT = findRepoRoot();
