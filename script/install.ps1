<#
.SYNOPSIS
一键安装 2ndBrain 环境（Hexo 博客本体 + Brain CLI 增强工具 + 主题下载）
#>

$ErrorActionPreference = "Stop"

# 定位仓库根目录：优先用 git 探测（脚本放在仓库任意层级都可以），
# 失败时回退到脚本上两级（script/ -> brain-cli/ -> 仓库根目录）
$ScriptPath = $MyInvocation.MyCommand.Path
$RootDir = git -C (Split-Path $ScriptPath) rev-parse --show-toplevel 2>$null
if (-not $RootDir) {
    $RootDir = Split-Path (Split-Path (Split-Path $ScriptPath))
}
Set-Location $RootDir

Write-Host "🚀 开始安装 2ndBrain 系统运行环境..." -ForegroundColor Cyan

# 1. 检测前置环境
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 未找到 npm！请先安装 Node.js (建议 >= 20.0)"
    exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 未找到 Git！请先安装 Git"
    exit 1
}

# 2. 初始化三个仓库及 blog 内部主题子模块
Write-Host "`n📦 [1/3] 初始化 blog、notes 和 Butterfly 子模块..." -ForegroundColor Yellow
git submodule update --init --recursive

# 3. 安装 Hexo 博客依赖
Write-Host "`n📝 [2/3] 安装 blog 依赖..." -ForegroundColor Yellow
if (Test-Path "blog") {
    npm --prefix blog install
} else {
    Write-Host "⚠️ 未找到 blog 子模块，跳过博客依赖安装。" -ForegroundColor Red
}

# 4. 安装与构建 Brain CLI
Write-Host "`n🧠 [3/3] 正在安装与构建本地工作流 CLI (brain-cli)..." -ForegroundColor Yellow
if (Test-Path "brain-cli") {
    Push-Location brain-cli
    npm install
    Write-Host "🔨 编译 TypeScript CLI..." -ForegroundColor Cyan
    npm run build
    Write-Host "🔗 正在注册全局 brain 命令..." -ForegroundColor Cyan
    npm link
    Pop-Location
} else {
    Write-Host "⚠️ 未找到 brain-cli 目录，跳过 CLI 安装。" -ForegroundColor Red
}

Write-Host "`n🛠 配置命令自动补全..." -ForegroundColor Yellow
$ans = Read-Host "是否要将 brain 命令补全添加到 PowerShell `$PROFILE? (y/N) "
if ($ans -match '^[Yy]$') {
    $CompletionScript = Join-Path $RootDir "brain-cli/script/brain-completion.ps1"
    $ProfileLine = ". `"$CompletionScript`""

    if (-not (Test-Path -Path (Split-Path $PROFILE))) {
        New-Item -ItemType Directory -Path (Split-Path $PROFILE) -Force | Out-Null
    }
    if (-not (Test-Path -Path $PROFILE)) {
        New-Item -ItemType File -Path $PROFILE -Force | Out-Null
    }

    $ProfileContent = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
    if ($null -ne $ProfileContent -and $ProfileContent.Contains($CompletionScript)) {
        Write-Host "⚠️ `$PROFILE 中已存在该配置" -ForegroundColor Yellow
    } else {
        Add-Content -Path $PROFILE -Value "`n# 2ndBrain CLI completion"
        Add-Content -Path $PROFILE -Value $ProfileLine
        Write-Host "✅ 已添加到 `$PROFILE" -ForegroundColor Green
    }
    Write-Host "💡 请打开新终端，或运行 '. `$PROFILE' 使其生效。" -ForegroundColor Cyan
}

Write-Host "`n🎉 全部环境安装&配置完成！" -ForegroundColor Green
Write-Host "👉 你现在可以运行:" -ForegroundColor Cyan
Write-Host "   brain init    - 检查并初始化知识库"
Write-Host "   brain status  - 查看第二大脑当前状态"
Write-Host "   npm --prefix blog run server - 启动本地 Hexo 预览服务"
