# 📖 CLI 命令参考

所有命令通过 `node brain-cli/dist/cli.js <command>` (或全局链接后的 `brain <command>`) 调用。

```bash
brain --help       # 查看所有命令
brain --version    # 查看版本号
```

---

## init

**🏗️ 初始化第二大脑目录结构**

```bash
brain init
```

创建 PARA 目录结构。并检查 `.env` 配置。首次使用应运行此命令。

---

## capture

**💡 快速捕获想法到本地笔记中**

```bash
brain capture <title> [选项]
```

### 参数

| 参数 | 说明 |
|------|------|
| `<title>` | **必填** 笔记标题 |

### 选项

| 选项 | 缩写 | 默认值 | 说明 |
|------|------|--------|------|
| `--content` | `-c` | `""` | 笔记正文内容 |
| `--tags` | `-t` | `""` | 标签，多个标签用逗号分隔 |
| `--type` | — | `Fleeting` | 笔记类型：`Fleeting` / `Literature` / `Permanent` / `Project` |

### 示例

```bash
# 最简用法——只有标题
brain capture "灵感：用 AI 自动整理笔记"

# 完整用法
brain capture "TypeScript 类型守卫" \
    --content "类型守卫本质是利用类型断言 narrows down..." \
    --tags "TypeScript,编程,基础" \
    --type Literature
```

---

## status

**📊 显示本地笔记与 Git 状态**

```bash
brain status
```

显示总笔记数、notes Git 状态和 Brain 总控仓库状态。`brain backup` 只处理独立的 `notes/` 仓库。

---

## backup

**💾 执行 Git 自动提交与备份**

```bash
brain backup [选项]
```

### 选项

| 选项 |缩写 | 说明 |
|------|-----|------|
| `--msg` | `-m` | 指定 Git 的 Commit Message |
| `--push` | - | 一并执行 Git push，推送至远程仓库 |

当前实现只处理 `notes/` 仓库：

1. 在 `notes/` 子模块内提交笔记正文变更。
2. 如果带 `--push`，只推送 `notes` 到其远程仓库。
3. Brain 总控仓库、blog 和子模块指针必须使用独立的 Git 提交流程。

```bash
brain backup -m "Update notes" --push
```

---

## watch

**🤖 管理后台 Watcher（文件监听与自动备份）守护进程**

```bash
brain watch <start|stop|status>
```

详细参见 [05-Watcher守护进程.md](./05-Watcher守护进程.md)。

---

## review

**🧠 回顾与翻阅已有笔记**

```bash
brain review <week|month|tags|random> [参数]
```

回顾候选会自动忽略导航和说明文档：`README.md`、`index.md`、`_index.md`。其他以下划线开头的内容笔记仍会正常参与回顾。

帮助你翻阅之前保存的本地笔记，唤醒记忆。

---

## graph

**🕸️ 展示标准 Markdown 双链知识图谱**

```bash
brain graph [--open] [--port 3738] [--scope active|all] [--note <note>] [--depth 1|2]
```

- `--scope active|all`：设置初始是否显示 archives，默认 `active`。
- `--note <note>`：以相对路径或标题启动 Local Graph。
- `--depth 1|2`：Local Graph 邻居深度，默认 1。
- 页面支持知识图谱/目录树切换、共享搜索、PARA/标签过滤、索引与孤岛开关、全局/局部切换和 VS Code 打开。
- Cytoscape 从本地依赖提供，不访问 CDN。

`brain graph` 和 `brain mindmap` 启动同一个页面：前者默认显示笔记链接关系，后者默认显示目录包含关系，页面内可以随时切换。
