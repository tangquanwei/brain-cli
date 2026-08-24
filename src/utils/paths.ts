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
    // 包名兼容：brain-cli（仓库内）、braincli（npm 发布名）、@xxx/brain-cli（scoped）
    const name = data.name ?? "";
    return (
      name === "brain-cli" || name === "braincli" || name.endsWith("/brain-cli")
    );
  } catch {
    return false;
  }
}

function findRepoRoot(): string {
  // 数据工作区只由用户当前目录决定，不能从 CLI 的安装位置推断。
  // 这能同时覆盖 npm 全局安装、npm link 和直接运行源码三种方式。
  const startDir = process.cwd();
  // 阶段一：主仓库模式 —— 某级目录下存在 brain-cli/package.json。
  // 同时要求该级是 Git 仓库根（含 .git），否则 GitHub Actions 的
  // /home/runner/work/brain-cli/brain-cli 双层同名目录会被误判为主仓库模式。
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (
      isBrainCliPkg(resolve(dir, "brain-cli")) &&
      existsSync(resolve(dir, ".git"))
    )
      return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 阶段二：独立源码仓库模式 —— brain-cli 自身就是 Git 仓库根。
  dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (isBrainCliPkg(dir) && existsSync(resolve(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 发布包模式：用户从哪个工作目录运行 brain，就以该目录为工作区。
  return startDir;
}

export const REPO_ROOT = findRepoRoot();
