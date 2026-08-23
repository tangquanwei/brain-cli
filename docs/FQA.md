# FAQ

## 本地仓库无法推送到 GitHub

### 问题

执行 `git push origin main` 时失败，提示：

```text
fatal: unable to access 'https://github.com/<your-account>/2ndBrain.git/': Could not resolve host: github.com
```

### 原因

本地仓库配置正常：

- 当前分支为 `main`，跟踪 `origin/main`。
- 远端地址为 `https://github.com/<your-account>/2ndBrain.git`。
- 本地 `main` 比 `origin/main` 超前 7 个提交，没有发现需要先拉取或解决的分支冲突。
- 在当前受限环境中访问 GitHub 时，DNS 无法解析 `github.com`，所以 Git 在连接 GitHub 前就失败了。
- 在允许外部网络访问的环境中，`git ls-remote` 和 `git push --dry-run origin main` 均成功，说明远端地址、认证和提交关系没有问题。

### 解决

1. 在正常终端中检查网络和 DNS：

   ```bash
   nslookup github.com
   git ls-remote origin
   ```

2. 如果 DNS 或网络不可用，先连接可访问 GitHub 的网络、VPN 或代理，再重试：

   ```bash
   git push origin main
   ```

3. 如果使用代理，确认 Git 的代理配置正确；不再使用代理时清除旧配置：

   ```bash
   git config --global --get-regexp 'http\..*proxy'
   git config --global --unset http.proxy
   git config --global --unset https.proxy
   ```

4. 推送前可先确认待推送提交数量：

   ```bash
   git fetch origin
   git log --oneline origin/main..main
   git push origin main
   ```

不要使用 `git push --force` 绕过该问题；当前案例只是网络/DNS 连接失败，不是远端拒绝或历史冲突。

## `notes` 子模块执行 `git pull` 提示不在分支上

### 问题

在 `notes/` 目录执行 `git pull` 时提示：

```text
You are not currently on a branch.
Please specify which branch you want to merge with.
```

### 原因

`notes` 是 Brain 总控仓库的 Git 子模块。总控仓库通过 gitlink 固定它应使用的提交；执行子模块更新后，Git 通常会把子模块检出到该提交，而不是检出某个本地分支，因此会出现 detached HEAD。

本次状态如下：

- 总控仓库固定 `notes` 为 `7da2f65`。
- `notes` 当前也在 `7da2f65`，工作区干净。
- `notes/main` 仍在 `f8d4c9a`，远端 `origin/main` 已到 `6d40fd5`。
- `7da2f65` 与远端 `origin/main` 已分叉，不能直接在 detached HEAD 上执行普通 `git pull`。

### 解决

如果只是要更新远端内容，先保留当前提交，再切回有跟踪关系的本地分支：

```bash
cd notes
git switch -c backup/notes-2026-07-12   # 保留总控仓库当前固定的 7da2f65
git switch main
git pull --ff-only origin main
```

此时总控仓库会显示 `notes` 子模块指针发生变化。确认内容无误后，在总控仓库提交这个 gitlink 变更：

```bash
cd ..
git diff --submodule=log -- notes
git add notes
git commit -m "chore: update notes submodule"
```

如果要同时保留本地 `7da2f65` 的 16 个文件改动，先创建备份分支后再把它与 `origin/main` 合并，并按冲突情况处理；不要直接删除 detached HEAD，也不要在未确认内容前执行 `git reset --hard`。
