# 示例知识库

这是一个虚构的小型知识库，可安全用于截图、演示和测试，不包含私人笔记。中文数据位于 `notes-zh`，英文数据位于 `notes`。

从独立检出的 `brain-cli` 根目录运行：

```bash
npm run dev -- doctor "$PWD/examples/demo-vault/notes-zh"
npm run dev -- --vault "$PWD/examples/demo-vault/notes-zh" web --open
```

笔记使用标准 Markdown 链接和紧凑的 PARA 目录结构，所有笔记都彼此关联，便于识别健康基线。

## 带连接的白板示例

示例还内置了白板文件 `notes-zh/.brain/whiteboards/research-map.json`。首次打开 WebUI 时，它会显示 8 张中文笔记卡片和 7 条有向连接：

```text
Launch a Knowledge Toolkit -> Build a Reading Habit
Build a Reading Habit -> Knowledge Management
Knowledge Management -> Markdown Links -> Git Backups -> Local-first Principle
Knowledge Management -> Writing -> Graph Exploration
```

从仓库根目录启动：

```bash
npm install
npm run build
node dist/cli.js --vault "$PWD/examples/demo-vault/notes" web --open
```

打开 WebUI 的“白板”页面后：

1. 点击“导入笔记”，把知识库笔记批量放到白板上。
2. 点击“新建卡片”，创建一张空白卡片。
3. 拖动空白处平移画布，拖动卡片调整布局。
4. 选中卡片后，可以编辑标题、内容和颜色。
5. 点击“连接卡片”，再点击另一张卡片，即可创建一条连接；画布上会显示箭头。
6. 使用搜索和缩放控件定位内容；白板布局和连接会自动保存。

连接数据使用简单的 `from`/`to` 格式：

```json
{
  "id": "management->markdown",
  "from": "note-areas/Knowledge Management.md",
  "to": "note-resources/Markdown Links.md"
}
```

白板状态保存在 `.brain/whiteboards`，Markdown 笔记仍然是知识库的事实来源。
