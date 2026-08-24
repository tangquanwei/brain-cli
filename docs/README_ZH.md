# 🧠 2ndBrain CLI

[English](../README.md) · **简体中文**

> 一个本地优先的 Markdown 知识库维护工具：安全重构、链接体检、Git 备份和即时知识图谱。

[![CI](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/tangquanwei/brain-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@qwtang/brain-cli)](https://www.npmjs.com/package/@qwtang/brain-cli)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../LICENSE)

![2ndBrain CLI：仪表盘、链接体检、安全重命名预览和知识图谱](https://raw.githubusercontent.com/tangquanwei/brain-cli/main/docs/screenshots/overview.gif)

2ndBrain CLI 直接处理普通 Markdown 文件，不要求云端账号、专有数据库或特定编辑器。笔记始终保存在你控制的目录中。

## 为什么使用它？

- **安全重构：**重命名或移动笔记时，同步更新相对 Markdown 链接和对应图片目录。
- **提前发现损坏：**检查断链、缺失标题或块引用、丢失嵌入、歧义 WikiLink、反向链接和孤岛笔记。
- **保留可恢复历史：**只提交配置的笔记仓库，并可选择推送远端。
- **看清知识结构：**在本地 WebUI 中浏览笔记、链接健康、回顾和知识图谱。

## 快速开始

需要 Node.js 20 或更高版本。

```bash
npm install -g @qwtang/brain-cli

mkdir my-brain
cd my-brain
brain init
brain web --open
```

全局安装后，当前工作目录就是工作区。请在包含笔记和可选 `.env` 的工作区内运行 `brain`。

检查已有 Markdown 或 Obsidian 知识库时，可以直接指定路径，无需初始化或迁移：

```bash
brain doctor /absolute/path/to/your/notes
brain --vault /absolute/path/to/your/notes web --open
```

体检和链接扫描默认只读：

```bash
brain --vault /absolute/path/to/your/notes links --stats --orphans
```

## 可复现示例 Vault

仓库包含一个体积很小、完全虚构且不含私人内容的示例知识库。你可以先用它评估扫描器和 WebUI，再连接自己的笔记。

```bash
git clone https://github.com/tangquanwei/brain-cli.git
cd brain-cli
npm install
npm run build

node dist/cli.js doctor "$PWD/examples/demo-vault/notes"
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
```

已验证的扫描结果：

```text
笔记数：                10
内部链接：              16
断链：                   0
缺失标题/块引用：         0
缺失图片/附件：           0
歧义 WikiLink：           0
孤岛笔记：               0
```

示例的目录和关系说明见 [Demo Vault README](../examples/demo-vault/README.md)。

## 与现有工具如何分工

| 工具 | 主要职责 |
| --- | --- |
| Obsidian | 以编辑器体验撰写和浏览 Markdown |
| VS Code | 编辑文件、脚本、模板和 Git 变更 |
| Git | 保存版本历史并同步仓库 |
| **2ndBrain CLI** | 捕获笔记、安全重构链接、检查知识库健康、自动化笔记仓库备份、打开本地图谱 |

2ndBrain CLI 不替代编辑器或 Git 客户端，而是处理 Markdown 知识库扩大后容易出错、又反复出现的维护工作。

## 核心命令

| 命令 | 作用 | 是否写入 |
| --- | --- | --- |
| `brain doctor <path>` | 无需初始化，直接体检已有知识库 | 否 |
| `brain init` | 创建默认工作区和 PARA 目录 | 是 |
| `brain capture <title>` | 创建带 frontmatter 的 Markdown 笔记 | 是 |
| `brain links --stats --orphans` | 检查链接和孤岛笔记 | 否 |
| `brain backlinks <note>` | 列出链接到指定笔记的笔记 | 否 |
| `brain rename <old> <new> --dry-run` | 预览安全重命名和链接更新 | 否 |
| `brain rename <old> <new>` | 重命名笔记并更新链接和图片 | 是 |
| `brain move <old> <new> --dry-run` | 预览移动和相对链接更新 | 否 |
| `brain backup [--push]` | 提交笔记仓库，并可选择推送 | 仅 Git |
| `brain review` | 根据本地元数据回顾笔记 | 否 |
| `brain web --open` | 启动本地仪表盘、编辑器、体检和图谱 | 仅使用编辑操作时写入 |
| `brain watch start` | 启动后台笔记维护 | 是 |

执行 `brain <command> --help` 可查看完整选项。

## 配置文件

临时连接已有知识库时使用全局 `--vault <path>`；需要持久默认值时，再在工作区创建 `.env`（参考 `.env.example`）。优先级依次为 `--vault`、`NOTES_DIR`、默认的 `notes`。

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NOTES_DIR` | `notes` | Markdown 知识库路径，可相对工作区或使用绝对路径 |
| `GIT_AUTO_COMMIT` | `true` | 支持的写操作完成后自动提交 |
| `COMMIT_INTERVAL` | `30` | Watcher 自动提交间隔，单位为秒 |
| `PUSH_INTERVAL` | `900` | Watcher 自动推送间隔，单位为秒 |
| `WATCH_ENABLED` | `true` | 是否启用 Watcher 行为 |

## 安全边界

- `brain web` 只监听 `127.0.0.1`，默认不会暴露到网络。
- `doctor`、链接扫描、反向链接、状态查询、回顾和带 `--dry-run` 的重构预览都是只读操作。
- `brain backup` 和 Watcher 只操作 `NOTES_DIR` 指向的 Git 仓库。
- 重命名和移动会更新标准相对 Markdown 链接以及已解析的 WikiLink；大规模重构前请先检查 dry run 并保留 Git 历史。
- 支持 Obsidian 笔记链接、别名、笔记嵌入、图片嵌入、标题和块引用。短名称对应多篇笔记时会报告歧义，请改用知识库相对路径。

## 文档

- [快速开始](guide/01-快速开始.md)
- [CLI 命令参考](guide/02-CLI命令参考.md)
- [配置参考](guide/04-配置参考.md)
- [链接扫描基准](benchmarks/link-scan.md)
- [Watcher 守护进程](guide/05-Watcher守护进程.md)
- [日常工作流](guide/06-日常工作流.md)
- [路线图](../TODO.md)
- [参与贡献](../CONTRIBUTING.md)
- [安全策略](../SECURITY.md)
- [版本变更](../CHANGELOG.md)
- [发布流程](RELEASING.md)

## 本地开发

```bash
npm install
npm test
npm run typecheck
npm run build
```

欢迎提交 Issue 和范围清晰的 PR。如果你正在用真实知识库试用，请告诉我们编辑器、操作系统、笔记数量和第一个卡点，但不要分享私人笔记内容。

## 许可证

[Apache-2.0](../LICENSE)
