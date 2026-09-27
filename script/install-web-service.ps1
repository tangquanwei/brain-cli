# 注册“登录时自动启动 brain WebUI 守护进程”的计划任务。
# 用法:
#   powershell -ExecutionPolicy Bypass -File script/install-web-service.ps1 [-Port 3739] [-Uninstall]
param(
  [int]$Port = 3739,
  [switch]$Uninstall
)

$TaskName = "BrainWebUI"
$RepoRoot = Resolve-Path "$PSScriptRoot\.."
$Cli = Join-Path $RepoRoot "dist\cli.js"

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "✅ 已移除计划任务 $TaskName"
  } else {
    Write-Host "⚠️  计划任务 $TaskName 不存在"
  }
  exit 0
}

if (-not (Test-Path $Cli)) {
  Write-Host "❌ 未找到 $Cli，请先运行 npm run build"
  exit 1
}

# 守护进程自身有 PID 互斥（brain web --daemon），重复触发不会起第二个实例
$node = (Get-Command node).Source
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$Cli`" web --daemon --port $Port" -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "✅ 已注册计划任务 $TaskName（登录时启动 brain web --daemon --port $Port）"
Write-Host "   立即启动: brain web --daemon --port $Port"
Write-Host "   查看状态: brain web status --port $Port"
Write-Host "   卸载:     powershell -ExecutionPolicy Bypass -File $PSCommandPath -Uninstall"
