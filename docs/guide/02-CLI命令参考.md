# 📖 CLI 命令参考

```bash
brain --help
brain --version
brain --vault /path/to/vault <command>
```

## 读写边界总览

| 命令 | 默认边界 | 可能写入的内容 |
| --- | --- | --- |
| `brain doctor [path]` | 只读 | 无 |
| `brain status` | 只读 | 无 |
| `brain links` | 只读 | 仅 `--write` 写入 `.brain/links.json` |
| `brain backlinks <note>` | 只读 | 无 |
| `brain review ...` | 只读 | 无 |
| `brain rename ... --dry-run` | 只读预览 | 无 |
| `brain move ... --dry-run` | 只读预览 | 无 |
| `brain init` | 写入 | 知识库目录和工作区模板目录 |
| `brain capture <title>` | 写入 | Markdown 笔记；启用时提交知识库 Git |
| `brain rename ...` | 写入 | 笔记、匹配附件目录和引用链接 |
| `brain move ...` | 写入 | 笔记、匹配附件目录和引用链接 |
| `brain backup [--push]` | Git 写入 | 仅知识库 Git 仓库 |
| `brain watch start` | 持续写入 | PID/日志以及知识库 Git 提交、推送 |
| `brain watch stop` | 进程控制 | Watcher PID/日志 |
| `brain watch status` | 只读 | 无 |
| `brain web` | 混合 | 浏览只读；捕获、重命名、移动等操作写入 |

## 全局 `--vault`

显式指定本次命令使用的知识库：

```bash
brain --vault /absolute/path/to/vault status
```

相对路径以当前工作目录为基准。该选项优先于 `NOTES_DIR`，且不会修改 `.env`。

## `doctor [path]`

无需初始化即可只读体检已有目录：

```bash
brain doctor /path/to/vault
brain doctor /path/to/vault --json
brain --vault /path/to/vault doctor
```

检查项包括 Markdown、标准链接、WikiLink、笔记嵌入、图片和附件、标题、块引用、歧义短名称及孤岛笔记。健康时退出码为 0；发现影响引用完整性的问题时为 1。

## `init`

```bash
brain --vault /path/to/new-vault init
```

创建 `projects`、`areas`、`resources`、`questions`、`archives`，并在工作区创建 `templates`。它不会自动创建 `.env`。

## `capture <title>`

```bash
brain --vault /path/to/vault capture "TypeScript 类型守卫" \
  --content "正文" \
  --tags "TypeScript,编程" \
  --type Literature
```

`--type` 支持 `Fleeting`、`Literature`、`Permanent`、`Project`。

## `links`

```bash
brain --vault /path/to/vault links --stats --orphans
brain --vault /path/to/vault links --check
brain --vault /path/to/vault links --json
brain --vault /path/to/vault links --write
```

- 默认只读。
- `--check` 在断链、缺失标题/块、缺失附件或歧义 WikiLink 时返回退出码 1。
- `--write` 是唯一会写文件的选项，目标为 `<vault>/.brain/links.json`。
- `--scope active|all` 控制孤岛列表范围。

支持的 Obsidian 形式：

- `[[Note]]`、`[[folder/Note]]`、`[[Note|Alias]]`
- `[[Note#Heading]]`、`[[Note#^block-id]]`
- `![[Note]]`、`![[image.png]]`
- 标准 Markdown 图片与 `Note.md#heading` / `Note.md#^block-id`

如果短名称匹配多篇笔记，会报告歧义；改用知识库相对路径即可。

## `rename` 与 `move`

```bash
brain --vault /path/to/vault rename "areas/Old.md" "New" --dry-run
brain --vault /path/to/vault move "areas/Old.md" "resources/New.md" --dry-run
```

去掉 `--dry-run` 后才会写入。操作会重写已解析的标准 Markdown 笔记链接和 WikiLink，并移动与笔记同名或 `<name>.assets` 的附件目录。源和目标都必须位于知识库内。

## `backlinks <note>`

```bash
brain --vault /path/to/vault backlinks "areas/My Note.md"
```

只读显示标准 Markdown 与 WikiLink 反向链接。

## `status`、`review`、`backup`、`watch`、`web`

```bash
brain --vault /path/to/vault status
brain --vault /path/to/vault review week
brain --vault /path/to/vault backup -m "Update notes" --push
brain --vault /path/to/vault watch start
brain --vault /path/to/vault web --open
```

`backup` 和 Watcher 的 Git 操作严格限制在知识库自身的 Git 仓库。WebUI 只监听 `127.0.0.1`；浏览、搜索和图谱是只读的，只有显式编辑操作才写入。
