# brain-cli TODO

目标：先让修复版本可靠到达用户，再提高 GitHub 首页转化率，获得首批真实用户，最后扩展搜索与 Agent 能力。

## P0：发布可用版本

- [ ] 审核当前未提交改动，确认不包含个人笔记或临时 smoke 文件。
- [ ] 将版本升级到 `0.1.2`，同步更新 Changelog。
- [ ] 运行测试、类型检查、构建、生产依赖审计和 `npm pack --dry-run`。
- [ ] 在系统临时目录安装打出的包，验证 `--version`、`brain init`、工作区路径和 WebUI；完成后删除临时文件。
- [ ] 提交并推送代码，创建 `v0.1.2` tag，发布 GitHub Release 和 npm 包。
- [ ] 从 npm 注册表重新安装 `0.1.2` 并做一次干净环境验证。
- [ ] 验证新版本后，为有问题的 `0.1.1` 添加 deprecated 提示。
- [ ] 将 npm 发布迁移到 OIDC Trusted Publishing，并启用 provenance。

## P1：首页定位与文档转化

- [x] 将根 README 调整为英文优先，并提供简体中文入口。
- [x] 将产品定位收窄为“Markdown 知识库的安全维护工具”。
- [x] 首屏突出安全重构、链接体检、Git 备份和本地知识图谱。
- [x] 制作 15～30 秒 GIF，演示检查断链、重命名笔记和打开 WebUI。
- [x] 提供不包含私人内容的示例 Vault。
- [x] 增加与 Obsidian、VS Code、Git 的职责对比，而不是泛泛比较“第二大脑”。

## P1：降低首次使用门槛

- [x] 支持显式指定已有知识库，例如全局 `--vault <path>`。
- [x] 增加只读 `brain doctor <path>`，无需初始化或迁移即可体检现有 Markdown 目录。
- [x] 明确所有命令的读写边界；预览和体检默认只读。
- [x] 完善 Obsidian WikiLink、嵌入图片、标题和块引用兼容性。
- [x] 使用 1K、10K 篇笔记的测试库记录扫描时间和内存占用。

## P2：GitHub 发现与社区

- [x] 添加 GitHub topics：`markdown`、`local-first`、`personal-knowledge-management`、`knowledge-graph`、`second-brain`、`zettelkasten`、`para-method`、`git`、`cli`、`typescript`。
- [x] 设置仓库主页和 Social Preview 图片。
- [x] 开启 Discussions，并配置 Announcements、Q&A、Ideas、Show and tell。
- [x] 添加 `CONTRIBUTING.md`、`SECURITY.md`、Issue 表单和 PR 模板。
- [x] 创建 3～5 个范围清晰的 `good first issue`，覆盖文档、兼容性和测试。
- [x] 发布稳定的 Changelog，并保持小版本发布节奏。

## P2：搜索与 Agent 接入

- [ ] 实现 `brain search <query> --json`，支持 tag、area 和路径过滤。
- [ ] 为主要只读命令提供稳定 JSON 输出和 exit code。
- [ ] 文档化本地检索 API 的请求、响应和版本契约。
- [ ] 在搜索契约稳定后实现只读 MCP：search、read、list、backlinks。
- [ ] 提供 Codex、Claude Code、Cursor 等客户端的接入示例。
- [ ] 暂不把云端 AI 或本地 embedding 设为基本安装依赖。

## P3：首批用户与推广

- [ ] 邀请 10 位 Markdown/Obsidian 用户用真实 Vault 试用。
- [ ] 记录安装系统、笔记规模、首次卡点、扫描结果和一周留存。
- [ ] 获得 2～3 条可公开的用户评价或案例。
- [ ] 中文发布：V2EX、知乎、少数派、掘金、即刻、Obsidian 中文社区。
- [ ] 英文发布：Show HN、Reddit `r/PKMS`、`r/selfhosted`、Obsidian 社区、Dev.to。
- [ ] 内容围绕具体问题：安全重命名、断链检查、Markdown + Git，而不是只说“第二大脑”。

## 30 天验收指标

- [ ] 20 个外部成功安装。
- [ ] 10 个用户扫描自己的真实 Vault。
- [ ] 5 个用户一周后仍在使用。
- [ ] 3 个有效外部 Issue。
- [ ] 2 个外部 PR。
- [ ] 1 篇真实使用案例。
- [ ] 在真实使用指标达成后争取首批 100 Stars。

## 已完成

- [x] 修复 npm 安装和 `npm link` 场景下的工作区路径识别。
- [x] CLI 版本改为读取 `package.json`。
- [x] `brain init` 补齐 `questions/`。
- [x] 修复 npm README 截图地址。
- [x] 清除生产依赖安全告警。
- [x] 添加 Node 20/22/24 与 Ubuntu/macOS/Windows CI 配置。
