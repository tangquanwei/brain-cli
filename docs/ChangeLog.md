# ChangeLog

记录项目实现层面的重要修改。最新记录放在最上方，时间统一使用 `Asia/Shanghai`。

## 2026-07-21 11:12 CST

### 做了什么

- 将项目文档统一归档到 `brain-cli/docs/`，并同步 README、项目指令和开发计划中的文档路径。
- 保留本次重组的时间戳记录、CLI 验证结果、Hexo 构建结果和 notes 工作区保护说明。

### 验证

- `git diff --check` 通过。
- 文档移动被识别为 `docs/` → `brain-cli/docs/` 重命名；本次未对 `notes/` 执行写操作，未提交或推送任何仓库。
- 本次检查时 `notes/` 工作树为 `a82c475`（与根仓库当前 gitlink 不同，因此根状态显示 `M notes`）；该状态不是本次文档更新产生的。

## 2026-07-21 10:52 CST

### 做了什么

- 完成 `brain-node` → `brain-cli` 的目录、npm 包名、源码路径、脚本和文档迁移；CLI 命令仍为 `brain`。
- 完成 `blog/` Git 子模块注册，并初始化其内部 `themes/butterfly` 子模块；根仓库旧的 `themes/butterfly` gitlink 已移除。
- 为 notes-only 备份边界增加临时 Git 仓库测试，覆盖自动提交、捕获、无变更、未初始化目录隔离、`--push` 及根仓库/blog 状态不变。
- 将本次整理与验证结果落盘到文档，并保留根仓库、blog、notes 均不 push 的状态。

### 为什么要做

- 让 Brain 总控仓库、独立 notes 仓库和独立 blog 仓库的职责与 Git 边界可验证、可维护。
- 防止 `brain backup` 或 Watcher 意外提交总控仓库、blog 或子模块指针。

### 影响范围

- `brain-cli/`、根仓库 `.gitmodules`、`blog/` 子模块注册、文档和 Git 边界测试。
- 未修改、提交或推送 `notes/` 的既有工作区改动；notes HEAD 仍为 `6d40fd59056fcf3ecb21be24fcc1e06d7a16efe7`。

### 验证

- `cd brain-cli && npm test`：10 个测试文件、26 个测试通过；`npm run typecheck`、`npm run build` 通过。
- `cd blog && npm install && npm run clean && npm run build`：Hexo 生成 373 个文件，`public/index.html` 非空（38,294 字节）。
- `git submodule status --recursive`：blog、blog 内 Butterfly、notes 均有有效映射；Butterfly 指向 `749cdf6`。
- 根级旧路径搜索、安装脚本语法检查、Tasks JSON 解析和 `git diff --check` 通过。
- notes 工作区状态哈希保持为 `de130dc60d70ac55900c27f2b27994d3497af0d30aa5339a96a9c0559b52a63e`；未执行任何 push。

## 2026-07-21 10:39 CST

### 做了什么

- 将根级文档、VS Code Tasks、Bash/PowerShell 安装脚本和项目指令中的 CLI 路径统一为 `brain-cli/`；用户可执行命令仍为 `brain`。
- 明确 `blog/`（`https://github.com/<your-account>/blog.git`）与 `notes/`（`https://github.com/<your-account>/notes.git`）都是独立 Git 子模块；Hexo 源码、主题和构建命令均归属 `blog/`。
- 将 `brain backup`、Watcher 及相关文档统一描述为只提交/推送 `notes/`，不自动提交 Brain 总控仓库、blog 或子模块指针。
- 恢复并更新根 `.github` 指令，补充递归子模块初始化、分层 Git 边界和博客验证流程。

### 为什么要做

- 仓库已拆分为 Brain 总控仓库、blog 和 notes 三层，旧的根目录 Hexo 路径和 CLI 目录命名会误导安装、开发和发布流程。
- notes 自动备份与总控仓库、blog 的版本固定必须保持独立，避免 CLI 意外提交总控仓库 gitlink。

### 影响范围

- 根 README、`brain-cli/docs/guide/`、实施计划、FAQ、TODO、VS Code Tasks、安装脚本和 `.github` 项目指令。
- 不修改 `blog/`、`notes/`、CLI 源码或 `.gitmodules`。

### 验证

- `bash -n script/install-env.sh`：通过。
- `node -e "JSON.parse(require('fs').readFileSync('.vscode/tasks.json','utf8'))"`：通过。
- `git diff --check`：通过（当前根仓库改动范围）。
- `rg` 根级残留检查：未发现旧 CLI 目录名、根级 `source/_posts`、根级 `themes/butterfly` 或 notes SSH URL；`blog/source/_posts` 等目标路径仅作为迁移规划文档中的预期路径保留。
- `brain-cli` 测试、Hexo 构建和完整递归子模块验证已在后续 10:52 CST 条目中补录。

## 2026-07-11 23:53 CST

### 做了什么

- 将 `brain mindmap` 和 `brain graph` 合并为同一个本地服务与页面，增加“知识图谱 / 目录树”即时切换。
- 新增基于 `NoteNode` 的目录树投影；目录树和图谱现在严格使用同一批 401 篇笔记。
- 两种视图共享搜索条件、节点详情、安全 VS Code 打开和 URL 状态。
- `brain graph` 默认进入图谱，`brain mindmap` 复用同一服务但默认进入目录树。
- 删除 mindmap 原有的独立文件扫描器、HTTP 服务和整页 HTML，保留薄 CLI 入口。
- 新增目录树投影测试，并更新 README、CLI 文档和图谱实施计划。

### 为什么要做

- 两套服务重复维护扫描、页面、浏览器启动和安全打开逻辑，容易产生行为差异。
- 用户需要从目录组织和知识关系两个角度连续探索，同页切换比启动两个端口更自然。
- 从统一 NoteIndex 派生两种视图可确保新增、移动和重命名笔记后结果一致。

### 影响范围

- `brain-cli` 的 graph 页面、目录树投影、graph API 和 mindmap 命令实现。
- README、CLI 文档、图谱计划与浏览器交互。
- 不修改笔记正文或链接数据。

### 验证

- 自动测试、类型检查、构建和链接检查。
- 浏览器验证图谱 → 目录树 → 图谱同页切换，目录树包含 38 个文件夹和 401 篇笔记。
- 搜索 `Tokenizer` 时目录树收敛到 1 篇，切回图谱后共享条件并显示 1 个节点。
- 验证 `brain mindmap` 默认使用目录树视图。
- 执行本次修改范围的 `git diff --check`。

## 2026-07-11 23:42 CST

### 做了什么

- 实现 `brain graph`：基于项目标准 Markdown 相对链接展示全局图和 1–2 跳 Local Graph。
- 新增 Graph View 数据投影，使用 notes 相对路径作为节点 id，聚合同向重复边，并分别计算 semanticDegree 与 indexDegree。
- 使用本地 Cytoscape.js 实现离线力导向图、PARA 配色、有向边、搜索、标签/区域过滤、archives/index/孤岛开关和节点详情。
- 支持通过 URL 恢复选中节点、全局/局部模式、深度和过滤状态。
- 新增安全打开笔记机制：仅接受当前索引中的相对 id，拒绝绝对路径和路径穿越，通过 `spawn` 参数数组启动 VS Code。
- 将 `brain mindmap` 的绝对路径 GET 打开接口迁移到同一安全机制。
- 新增 graph projection、filter/local graph 和 safe open 测试。
- 更新 README、CLI 命令参考和 VS Code Tasks。

### 为什么要做

- 本项目的双链以真实 Markdown 相对路径解析，不适合直接依赖 Obsidian wikilink 图谱。
- `_index.md` 会形成导航型超级节点，因此需要把索引关系与语义关系分开统计和显示。
- 原 mindmap 打开接口接收绝对路径并使用 shell 字符串，必须在新增浏览器功能时收紧本地安全边界。

### 影响范围

- `brain-cli` 图谱数据、CLI、本地 HTTP 服务、mindmap 打开机制、依赖与测试。
- README、CLI 文档、VS Code Tasks 和图谱实施计划。
- 不修改笔记正文和现有标准 Markdown 链接。

### 验证

- `npm run verify`：8 个测试文件、20 个测试，类型检查、构建和 `brain links --check` 全部通过。
- HTTP 验证页面与 Cytoscape 本地资源返回 200；投影为 401 节点、232 条聚合边且无绝对路径；路径穿越返回 404。
- 浏览器验证暗色布局、搜索过滤、54 节点/47 边默认全局图，以及 30 节点/30 边的二跳 Local Graph。
- 执行本次修改范围的 `git diff --check`。

## 2026-07-11 23:31 CST

### 做了什么

- 新增 `GraphImplementationPlan.md`，定义基于标准 Markdown 双链的 `brain graph` 实现计划。
- 明确复用 `markdownLinks`、`noteIndex` 和 `buildLinkGraph`，保留 `brain mindmap` 作为独立目录树功能。
- 确定 Cytoscape.js 本地离线方案、Graph View 数据契约、全局图/Local Graph 交互和 G0–G4 实施顺序。
- 把安全打开笔记列为前置要求：相对路径白名单、禁止路径穿越、使用 `spawn` 参数数组并迁移 mindmap 的现有打开逻辑。
- 在总实施计划 P3 中加入图谱计划入口。

### 为什么要做

- 本项目使用标准 Markdown 相对路径双链，与 Obsidian wikilink 的解析和身份模型不同，需要自有图谱展示层。
- 现有链接图数据已经成熟，先明确数据投影和安全边界可以避免重复开发链接解析器。
- `_index.md` 与 archives 会显著影响力导向布局，需要在实现前定义独立 degree 和默认过滤策略。

### 影响范围

- 项目架构与 P3 可视化规划文档。
- 本次未修改 CLI、依赖、笔记或运行行为。

### 验证

- 检查计划中的文件路径、CLI 名称与当前实现一致。
- 检查总实施计划到图谱计划的相对链接。
- 执行本次文档范围的 `git diff --check`。

## 2026-07-11 23:09 CST

### 做了什么

- 为 `brain review` 增加特殊文档过滤，默认忽略 `README.md`、`index.md` 和 `_index.md`，匹配时不区分大小写。
- 新增 review 过滤单元测试，确认导航文档被排除、普通文件被忽略，同时保留 `_思必驰 ASR + RAG 项目.md` 这类真实内容笔记。
- 在 CLI 命令参考中记录过滤规则。

### 为什么要做

- 索引和目录说明用于导航，不适合作为 week、month、tags 或 random 的回顾内容。
- 使用精确文件名过滤可以避免粗暴排除所有以下划线开头的真实项目笔记。

### 影响范围

- `brain-cli/src/commands/review.ts` 的所有 review 子命令候选集合。
- review 单元测试和 CLI 文档。

### 验证

- 执行 `npm run verify`，验证测试、类型检查、构建和链接检查。
- 执行 `git diff --check`；本次修改无空白错误，但检查仍报告任务前已有的 `TODO.md` 文件末尾空行。

## 2026-07-11 22:58 CST

### 做了什么

- 完成实施计划 P0：修复 10 个断链并迁移或标记 12 个非标准链接。
- 修复 wikilink 扫描器对 fenced code、行内代码和 Token ID/浮点数组的误判。
- 为 `brain links` 增加 `--stats` 与 `--scope active|all`，并在 JSON 图谱中提供按 PARA 区域划分的孤岛统计。
- 新增链接统计测试，覆盖代码块、数字数组、同页锚点和 active/archive 范围划分；测试总数由 9 增至 12。
- 为 ASR+RAG2026、OmniRAG、Jobs 和 Future Projects 补齐项目入口链接。
- 新增领域、资源和开放问题索引，使活跃笔记可以从稳定入口访问。
- 新增 `npm run verify`，统一运行测试、类型检查、构建和 `brain links --check`。

### 为什么要做

- 断链和解析误报会降低链接检查的可信度，必须先解决才能建设知识图谱。
- 全部孤岛混在一个数字里无法区分活跃知识和合理归档，按 PARA 区域统计更利于采取行动。
- 项目和领域入口能提供真实导航上下文，而不是依靠无意义的批量互链降低孤岛数字。
- 把链接检查纳入本地验证可阻止后续代码或笔记移动重新引入断链。

### 影响范围

- `brain-cli` 的 Markdown 解析、链接图、CLI 参数、测试及 npm scripts。
- `notes/` 子模块中的断链来源、项目入口和知识索引。
- README、实施计划与开发验证流程。

### 验证

- `npm test`：4 个测试文件、12 个测试通过。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `brain links --check --stats`：断链 0、缺失标题 0、非标准链接 0。
- 最终知识图谱包含 401 篇笔记和 233 条标准内部链接；活跃孤岛由 152/188（80.8%）降至 0/193（0%）。
- `git diff --check`：通过。

## 2026-07-11 22:49 CST

### 做了什么

- 新增 `ImplementationPlan.md`，将知识库改进拆分为 P0–P5 六个阶段。
- 明确每个阶段的目标、工作项、验收标准、依赖顺序和建议里程碑。
- 建立 ChangeLog 记录格式，并规定代码修改必须同步登记时间、内容、原因、影响范围和验证结果。
- 更新项目专属 `brain-manager` Skill，使后续代码开发自动检查并维护本文件。

### 为什么要做

- 现有改进建议缺少可执行顺序和完成标准，容易同时展开过多功能。
- 项目同时包含 notes 子模块、TypeScript CLI 和 Hexo 发布层，需要明确边界和验证流程。
- 通过强制记录“何时、做了什么、为什么”，保留架构决策背景，降低未来维护成本。

### 影响范围

- 项目规划与开发流程文档。
- `.github/skills/brain-manager/` 项目专属 Skill。
- 本次未修改 CLI 运行逻辑和笔记内容。

### 验证

- 检查 Markdown 文件结构和内部链接路径。
- 执行 `git diff --check`，确保无空白字符错误。

## 2026-05-30

把notion迁移到了本地
