# 💻 VS Code 集成指南

Second Brain 深度集成了 VS Code，让你在编辑器内完成所有操作， 无需频繁切换到终端。

---

## Tasks（任务系统）

### 运行任务的方法

有三种方式运行预配置的任务：

**方式一：命令面板（推荐）**
1. `Ctrl+Shift+P` 打开命令面板
2. 输入 `Tasks: Run Task`
3. 选择要运行的任务

**方式二：构建任务快捷键**
- `Ctrl+Shift+B` → 列出所有 build 组任务

### 核心任务清单

| 任务 | 说明 |
|------|------|
| 💡 快速捕获想法（本地） | 弹出输入框填标题/内容/标签并保存本地 |
| 📊 查看状态 | 显示当前笔记统计和 Git 状态 |
| 💾 Git 备份 | 只在 notes 仓库执行 `git add + commit` |
| 💾 Git 备份 + 推送远程 | 只提交并推送 notes |
| 🔨 构建 brain-cli | 执行 `npm run build` |

#### Watcher 守护进程

| 任务 | 说明 |
|------|------|
| 🤖 启动 Watcher 守护进程 | 启动后台进程进行自动同步备份 |
| 🛑 停止 Watcher | 终止守护进程 |
| 📊 Watcher 状态 | 查看运行情况 |

### 💡 捕获任务的输入弹窗

运行「💡 快速捕获想法（本地）」时，VS Code 会弹出 3 个输入框：

1. **📝 笔记标题**（必填）
2. **📄 笔记内容**（可选，直接回车跳过）
3. **🏷️ 标签**（可选，逗号分隔）

---

## Snippets（代码片段）

在 `.md` 文件中输入前缀并按 `Tab` 键，即可插入预设模板。

### newnote — 通用笔记

```
newnote + Tab
```

生成：

```markdown
---
title: "标题"
date: "2026-03-02"
tags: [标签]
type: Fleeting
status: draft
---

# 标题

## 要点

- 

## 我的思考



## 行动项

- [ ] 
```

> `type` 支持下拉选择：Fleeting / Literature / Permanent / Project

### daily — 每日笔记

```
daily + Tab
```

生成包含「今日目标」、「笔记」、「想法」、「今日回顾」四个板块的日记模板，日期自动填充。

### weekly — 每周回顾

```
weekly + Tab
```

生成包含「本周完成」、「未完成 & 原因」、「本周洞察」、「下周计划」、「关键指标」的周回顾模板。

### technote — 技术笔记

```
technote + Tab
```

生成包含「问题/背景」、「解决方案（含代码块）」、「关键点」、「参考链接」的技术笔记模板。

### 小技巧

- 插入后按 `Tab` 在各占位符之间跳转
- `type` 字段支持下拉选择（Snippet Choice）
- 日期、星期会自动填充当天值

---

## 推荐扩展

| 扩展 | ID | 用途 |
|------|----|------|
| Markdown All in One | `yzhang.markdown-all-in-one` | Markdown 增强 |
| ESLint | `dbaeumer.vscode-eslint` | JS/TS 代码规范 |
| Prettier | `esbenp.prettier-vscode` | 代码格式化 |

---

## 下一步

- ⚙️ [配置参考](./04-配置参考.md) — 详细了解每个配置项
- 🤖 [Watcher 守护进程](./05-Watcher守护进程.md) — 自动化原理详解
