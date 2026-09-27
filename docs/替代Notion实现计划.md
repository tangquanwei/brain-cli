# 替代 Notion 实现计划：让 Brain 成为日常记录主力

> 背景：用户的 Notion 网页版核心用途是"瞬时记录"——想到什么随手打开就写。当前 brain WebUI 是只读观察台，启动有摩擦、不能编辑、手机够不到，因此无法替代。
>
> 设备环境：Windows 笔记本（主设备，本仓库所在）、MacBook、iPhone，设备间通过异地组网 APP（Tailscale/ZeroTier 类）互联。
>
> 已有能力：微信 → Agent → notes 的自动整理链路已存在，是手机端的兜底输入。
>
> 明确不做：实时多人协作、Notion 式数据库视图。

## 1. 目标体验

达成以下三条即认为"可以替代 Notion 网页版"：

1. **任何设备 2 秒内可记录**：浏览器书签/PWA 图标点开就是一个输入框，无需先启动任何服务。
2. **笔记可在网页里编辑**：多端同一份数据，改完自动保存、自动 Git 备份。
3. **三端数据一致**：Windows / Mac / 手机（经 Windows）看到的永远是同一份知识库。

## 2. 总体架构

```
                 ┌─────────────┐
   iPhone ──────▶│  Tailscale   │◀────── MacBook
 （PWA/Safari）   │  加密组网     │  （git pull/push + brain watch）
                 └──────┬──────┘
                        │ http://<tailscale-ip>:3739
                 ┌──────▼──────────────┐         ┌────────────────┐
                 │ Windows（常驻服务）    │────────▶│ GitHub 私有仓库  │
                 │ brain web --daemon   │  push    │ （唯一事实源）    │
                 │ brain watch（已有）   │◀────────│                │
                 └─────────────────────┘  pull    └────────────────┘
```

关键决策：

- **数据同步走 Git，不走服务转发**。notes 已是 Git 仓库且 watcher 已支持自动 push，这是现成的同步骨架；MacBook 克隆同一仓库并跑自己的 watcher，两台电脑互为对等节点，远程仓库是唯一事实源。
- **手机不做本地副本**。iPhone 通过组网访问 Windows 上的常驻 WebUI（MacBook 同理，也可直连自己本地实例）。这样手机端永远拿到最新数据，无冲突。
- **Windows 实例需要 7×24 可用**，所以 WebUI 必须能常驻后台、崩溃自愈。这是本计划最大的新增基础能力。

## 3. 实施阶段

### Phase 0：同步骨架（现在就能做，约半天）

目标：Windows ↔ Mac 两端 Git 同步跑通，不依赖任何新代码。

- [ ] 在 Windows 确认 `notes/` 已有 GitHub 私有远程（`brain backup --push` 可用）
- [ ] MacBook 克隆 brain 主仓库，`npm install && npm run build`，配置 `.env` 指向克隆的 notes
- [ ] 两端都配置 Tailscale，`tailscale status` 互 ping 通
- [ ] 手动验证闭环：Windows `brain capture` → watcher 自动 push → Mac `git pull` 可见
- [ ] **为 watcher 增加自动拉取**（见 Phase 3，本阶段可暂时手动 pull）

验收：两端各自记一条笔记，15 分钟内互相可见。

### Phase 1：WebUI 常驻 + 组网可达

目标：Windows 上的 WebUI 像系统服务一样活着，任何组网设备通过 token 访问。

**1.1 Web 服务守护进程**（复用 `src/watcher/daemon.ts` 的 PID/日志模式）

- [x] `brain web --daemon`：spawn detached 子进程，`web.pid` + `logs/web.log` 管理生命周期
- [x] `brain web stop|status` 子命令（对齐现有 watch 命令组的交互）
- [x] Windows 开机自启：提供 `script/install-web-service.ps1`（计划任务，登录时触发 `brain web --daemon`）

**1.2 监听地址与鉴权**（安全前提：只在内网/组网内监听，绝不暴露公网）

- [x] 新增 env：`WEB_HOST`（默认 `127.0.0.1`，组网场景设为 `0.0.0.0`）、`WEB_TOKEN`
- [x] `WEB_TOKEN` 非空时，`server.ts` 对所有 `/api/*` 路由（含 `/api/events`）要求 `Authorization: Bearer <token>` 或 `?token=`
- [x] 前端首次访问弹 token 输入，存入 localStorage，之后所有请求携带（URL ?token= 首访自动持久化并抹除地址栏）

**1.3 MacBook 同样可起本地实例**（读自己克隆的 notes，改完由其本地 watcher 提交）

验收：手机 Safari 打开 `http://<windows-tailscale-ip>:3739/?token=xxx`，能浏览笔记；Windows 重启后服务自动恢复。

### Phase 2：能写——网页编辑 + 瞬时捕获

目标：体验对齐"打开 Notion 就写"。

**2.1 笔记正文编辑**（WebUI 从观察台变工作台）

- [x] `PUT /api/note`：写 Markdown 正文，走 `resolveSafeNote` 路径校验 + 原子写（临时文件+rename），写完触发 `autoCommit`
- [x] 前端笔记视图加"编辑"切换：等宽字体编辑区（Markdown 源码）；编辑中暂停 SSE 自动刷新
- [x] 编辑期间禁用该文件的 SSE 自动刷新，避免覆盖未保存内容

**2.2 瞬时捕获页（替代 Notion 的核心场景）**

- [x] 新增 `/api/inbox`（POST 纯文本）：带时间戳追加到 `notes/resources/INBOX.md`，首次自动创建
- [ ] 前端极简捕获页：一个自动聚焦的大 textarea + 发送按钮，路径 `/?view=capture`，首屏刻意轻量（可单独小 bundle 或内联到 page.ts，保证手机秒开）
- [x] 快捷键：桌面端 WebUI 任意页面 `Cmd/Ctrl+J` 唤起瞬时记录弹层，`Cmd/Ctrl+Enter` 发送

**2.3 iPhone PWA**

- [x] `page.ts` 输出 manifest + `apple-mobile-web-app-capable` meta
- [ ] iPhone"添加到主屏幕"，图标点开直达捕获页（token 已在 URL）
- [ ] 微信链路保留为离线/在路上时的兜底（已有）

验收：手机上从解锁到记完一条想法 ≤ 10 秒；Windows 上编辑一段正文，保存后 15 分钟内出现在 Mac 上。

### Phase 3：同步可靠性（自动拉取与冲突策略）

- [x] watcher 新增 `PULL_INTERVAL`：定时 `git pull --rebase`，让 Mac 端无人值守也能拿到 Windows 的更新
- [x] rebase 冲突时策略：abort rebase、本地提交推送到 `backup/conflict-<hostname>-<ts>` 分支并写 watcher 日志告警，绝不自动覆盖任何一端
- [ ] `brain doctor` 增加同步健康检查项：落后远程多少 commit、是否有未推送提交、上次 pull 时间

验收：两端同时编辑不同文件，15 分钟后自动合并且无人工干预；编辑同一文件产生冲突时，两端内容都不丢。

### Phase 4：体验打磨（可选，按需）

- [ ] Windows 全局热键（PowerToys Run 插件或 AHK）调起捕获页，压平最后一层摩擦
- [ ] WebUI 首页默认改为"最近笔记 + 捕获框"，而非仪表盘
- [ ] 捕获页支持语音输入（Web Speech API）——躺着记
- [ ] Hexo 发布链路保持不变（这个先不管）

## 4. 配置项汇总（新增）

| env | 默认 | 说明 |
|---|---|---|
| `WEB_HOST` | `127.0.0.1` | Web 监听地址；组网设备访问时设 `0.0.0.0` |
| `WEB_TOKEN` | 空 | 非空则所有 Web 请求需携带 token |
| `PULL_INTERVAL` | `0`（禁用） | watcher 自动 `pull --rebase` 间隔秒数 |

## 5. 风险与边界

- **单点依赖 Windows**：手机/Mac（不跑本地实例时）依赖 Windows 在线且 Tailscale 在线。缓解：Phase 3 后 Mac 本地实例也是完整副本，可互为 Plan B。
- **token 即全部防线**：本质上等价"内网可见即可改"。不开放公网的前提下可接受；若未来要 HTTPS/公网，必须再加 Tailscale Serve 证书或 BasicAuth 之外的鉴权。
- **Git 同步的分钟级延迟**：瞬时记录场景下，多设备交叉编辑同一 inbox 可能撞车。缓解：Phase 2 的 inbox 按"当日文件"追加 + Phase 3 冲突分支兜底；不做实时合并。
- **范围刻意收敛**：不做协作、不做数据库视图、不做富文本所见即所得——Markdown 源码编辑即可，保住"数据是纯文本"这个立身之本。

## 6. 里程碑建议

| 里程碑 | 内容 | 判定 |
|---|---|---|
| M1（第 1 周） | Phase 0 + Phase 1 | 手机能浏览，服务重启自愈 |
| M2（第 2 周） | Phase 2 | 手机 10 秒内完成一次记录；开始强制自己只用 Brain 记录 |
| M3（第 3 周） | Phase 3 | 一周无手动 git 操作、无内容丢失 |
| M4 | Phase 4 按需 + 复盘 | 7 天内未打开过 Notion 记录面板 = 替代成功 |
