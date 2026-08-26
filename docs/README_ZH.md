<div align="center">

<img src="https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/social-preview.png" alt="2ndBrain CLI — Markdown 知识库的安全维护工具" width="100%">

### 看清知识库，安心重构

**一个面向 Markdown 与 Obsidian 知识库的本地优先维护工具。**<br>
发现链接腐化、安全重命名和移动笔记、保留 Git 备份、探索知识图谱——无需把私人笔记交给云服务。

[![CI](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@qwtang/brain-cli?color=2563eb)](https://www.npmjs.com/package/@qwtang/brain-cli)
[![npm downloads](https://img.shields.io/npm/dm/@qwtang/brain-cli?color=06b6d4)](https://www.npmjs.com/package/@qwtang/brain-cli)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../LICENSE)

[快速开始](#60-秒快速开始) · [功能演示](#功能演示) · [示例知识库](#不使用自己的笔记也能体验) · [完整文档](#文档) · [English](../README.md)

</div>

---

你的笔记已经是可读、可迁移的普通文件，维护它们也应该同样简单。

2ndBrain CLI 在 Markdown 文件外增加了一层谨慎的维护能力：先检查、再修改；危险操作先预览；笔记操作始终限制在你指定的知识库内。

<div align="center">

**无需云端账号 · 无需数据库迁移 · 不绑定特定编辑器**

</div>

## 补上知识库缺少的维护层

| | 能力 | 你能获得什么 |
| --- | --- | --- |
| 🔎 | **体检** | 断链、缺失标题或块引用、丢失嵌入、歧义 WikiLink、反向链接和孤岛笔记 |
| 🛠️ | **重构** | 带 dry-run 预览的安全重命名和移动，以及自动链接重写 |
| 🕸️ | **探索** | 本地仪表盘、笔记浏览、回顾、链接健康和交互式知识图谱 |
| 🛡️ | **保护** | 仅针对笔记仓库的 Git 提交、可选推送，以及边界严格的后台 Watcher |
| ✍️ | **捕获与回顾** | 带 frontmatter 的快速笔记，以及按周、按月、按标签和随机回顾 |

它直接使用你已有的 Markdown 知识库，并兼容 Obsidian 别名、笔记嵌入、图片嵌入、标题和块引用。

## 功能演示

![2ndBrain CLI 功能演示：检查链接、预览安全重命名并打开本地 WebUI](https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/overview.gif)

<p align="center"><sub>检查链接健康 → 预览安全重命名 → 浏览本地仪表盘与知识图谱。</sub></p>

## 60 秒快速开始

需要 [Node.js 20 或更高版本](https://nodejs.org/)。

```bash
npm install -g @qwtang/brain-cli

mkdir my-brain && cd my-brain
brain init
brain web --open
```

这会创建一个本地工作区，并在 `127.0.0.1` 打开 WebUI。你的笔记仍然是磁盘上的普通 Markdown 文件。

### 已经有 Markdown 或 Obsidian 知识库？

直接指定路径即可，无需初始化、导入或迁移：

```bash
# 只读体检
brain doctor /absolute/path/to/your/notes

# 只读链接与孤岛扫描
brain --vault /absolute/path/to/your/notes links --stats --orphans

# 打开本地 WebUI
brain --vault /absolute/path/to/your/notes web --open
```

> **推荐的第一步：**`doctor` 和链接扫描都是只读操作；重命名或移动笔记前，请先使用 `--dry-run`。

## 为普通 Markdown 准备的可视化工作区

WebUI 把本地文件组织成专注的维护工作区，同时始终以文件系统为事实来源。

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/dashboard.png" alt="展示知识库健康和最近笔记的本地仪表盘"></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/graph.png" alt="交互式本地知识图谱"></td>
  </tr>
  <tr>
    <td align="center"><strong>一眼掌握知识库健康</strong><br><sub>笔记、PARA 分区、链接健康、Git 状态和最近活动。</sub></td>
    <td align="center"><strong>交互式知识图谱</strong><br><sub>不上传笔记，也能探索知识关系。</sub></td>
  </tr>
</table>

## 更安心的日常工作流

1. **先检查**，确认知识库当前状态。

   ```bash
   brain status
   brain links --check --stats --orphans
   ```

2. **先预览**重构结果，再放心执行。

   ```bash
   brain rename "areas/旧名称.md" "新名称" --dry-run
   brain rename "areas/旧名称.md" "新名称"
   ```

3. **再保存**到笔记仓库的 Git 历史中。

   ```bash
   brain backup
   brain backup --push
   ```

## 与你已有的工具协作

| 工具 | 主要职责 |
| --- | --- |
| Obsidian | 以编辑器体验撰写和浏览 Markdown |
| VS Code | 编辑文件、脚本、模板和 Git 变更 |
| Git | 保存版本历史并同步仓库 |
| **2ndBrain CLI** | 体检、安全重构、回顾、备份和可视化 Markdown 知识库 |

2ndBrain CLI 不替代编辑器或 Git 客户端，而是处理知识库扩大后容易出错、又不断重复的维护工作。

## 核心命令

| 命令 | 作用 | 是否写入 |
| --- | --- | --- |
| `brain doctor <path>` | 无需初始化，直接体检已有知识库 | 否 |
| `brain status` | 查看知识库和 Git 状态 | 否 |
| `brain init` | 创建默认工作区和 PARA 目录 | 是 |
| `brain capture <title>` | 创建带 frontmatter 的 Markdown 笔记 | 是 |
| `brain links --stats --orphans` | 检查链接和孤岛笔记 | 否 |
| `brain backlinks <note>` | 列出链接到指定笔记的笔记 | 否 |
| `brain rename <old> <new> --dry-run` | 预览安全重命名和链接更新 | 否 |
| `brain move <old> <new> --dry-run` | 预览移动和相对链接更新 | 否 |
| `brain backup [--push]` | 提交笔记仓库，并可选择推送 | 仅 Git |
| `brain review week` | 根据本地元数据回顾笔记 | 否 |
| `brain web --open` | 启动本地仪表盘、笔记浏览、体检和图谱 | 仅编辑操作写入 |
| `brain watch start` | 启动后台笔记维护 | 是 |

执行 `brain <command> --help` 可查看全部选项。

## 安全本身就是功能

- **默认仅限本地：**`brain web` 只监听 `127.0.0.1`。
- **只读检查：**体检、链接、反向链接、状态、回顾和 dry-run 预览都不会修改笔记。
- **Git 操作有边界：**备份和 Watcher 只操作 `NOTES_DIR` 对应的 Git 仓库。
- **路径保护：**重构操作会拒绝知识库之外的路径。
- **变更可恢复：**大规模移动前先预览，并使用 Git 保留历史。

当多个笔记拥有相同短名称、导致 WikiLink 存在歧义时，CLI 会报告问题而不是猜测。此时请使用知识库相对路径消除歧义。

## 不使用自己的笔记也能体验

仓库内置了一个完全虚构、不含私人内容的小型知识库，可用于安全评估扫描器和 WebUI。

```bash
git clone https://github.com/tangquanwei/brain-cli.git
cd brain-cli
npm install
npm run build

node dist/cli.js doctor "$PWD/examples/demo-vault/notes"
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
```

该示例已验证包含 10 篇笔记和 16 条内部链接，断链、缺失引用、歧义 WikiLink 和孤岛笔记均为 0。可在 [Demo Vault README](../examples/demo-vault/README.md) 查看目录结构、白板连接示例与预期关系，也可以阅读[中文说明](../examples/demo-vault/README_ZH.md)。

## 配置

临时选择知识库时使用 `--vault <path>`；需要持久默认值时，根据 [`.env.example`](../.env.example) 创建工作区级 `.env`。解析优先级依次为 `--vault`、`NOTES_DIR`、默认的 `notes`。

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NOTES_DIR` | `notes` | Markdown 知识库路径，可相对工作区或使用绝对路径 |
| `GIT_AUTO_COMMIT` | `true` | 支持的写操作完成后自动提交 |
| `COMMIT_INTERVAL` | `30` | Watcher 自动提交间隔，单位为秒 |
| `PUSH_INTERVAL` | `900` | Watcher 自动推送间隔，单位为秒 |
| `WATCH_ENABLED` | `true` | 是否启用 Watcher 行为 |

## Agent Skills

使用一条命令为 Codex 和 OpenClaw 全局安装本仓库的 Skills：

```bash
npx --yes skills add tangquanwei/brain-cli --skill '*' --global --agent codex openclaw --yes
```

该命令会添加用于安全操作知识库的 [`operate-brain-vault`](../skills/operate-brain-vault/SKILL.md)，以及用于维护本项目的 [`maintain-brain-cli`](../skills/maintain-brain-cli/SKILL.md)。如果新 Skill 没有立即出现，请重启 Agent。若要安装到[其他受支持的 Agent](https://github.com/vercel-labs/skills#supported-agents)，请增加或替换 `--agent` 后的名称。

## 文档

- [快速开始](guide/01-快速开始.md) · [CLI 命令参考](guide/02-CLI命令参考.md) · [配置参考](guide/04-配置参考.md)
- [链接扫描基准](benchmarks/link-scan.md) · [Watcher 守护进程](guide/05-Watcher守护进程.md) · [日常工作流](guide/06-日常工作流.md)
- [路线图](../TODO.md) · [版本变更](../CHANGELOG.md) · [参与贡献](../CONTRIBUTING.md) · [安全策略](../SECURITY.md)

## 本地开发

```bash
npm install
npm test
npm run typecheck
npm run build
```

欢迎提交 Issue 和范围清晰的 PR。反馈真实知识库的使用体验时，请提供编辑器、操作系统、笔记数量和第一个卡点，但不要分享私人笔记内容。

<div align="center">

为既想拥有知识工具的便利，又重视普通文件耐久性的人而构建。

[开始使用](#60-秒快速开始) · [提交 Issue](https://github.com/tangquanwei/brain-cli/issues) · [Apache-2.0](../LICENSE)

</div>
