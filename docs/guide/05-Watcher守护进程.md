# 🤖 Watcher 守护进程

Watcher 提供**自动备份触发**，让你专注于写作。

当前仓库中 `notes/` 已拆成独立 Git 子模块。Watcher 检测到笔记变更后，会复用 `brain backup` 的逻辑，只提交 `notes/` 仓库，不触碰 Brain 总控仓库、blog 或子模块指针。

## 工作原理

Watcher 作为独立后台 Node 进程运行（在 Windows 和 Mac 分别使用了 `fs.watch` 以及 pm2 或类似的后端脱离方式）。

每隔指定时间：
1. **自动扫描变更** (`COMMIT_INTERVAL`)，利用 `simple-git` 自动提交 `notes`
2. **自动推送远程** (`PUSH_INTERVAL`)

手动同步也可以直接使用：

```bash
brain backup -m "Update notes" --push
```

## 基础命令

### 启动服务
```bash
brain watch start
```
该命令会触发底层的后台运行。在 VS Code 任务中也可直接执行。

### 查看状态
```bash
brain watch status
```
展示 Watcher 的 PID、运行时间以及上一次拉取推送的状态。

### 停止服务
```bash
brain watch stop
```
优雅停止 Watcher。
