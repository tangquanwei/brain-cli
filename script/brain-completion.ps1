# 2nd Brain CLI — PowerShell tab completion
#
# 安装方法（任选其一）:
#   1. 运行 brain-cli/script/install.ps1，按提示自动写入 $PROFILE
#   2. 手动在 $PROFILE 中添加（用实际仓库路径替换 <仓库根目录>）:
#        . "<仓库根目录>/brain-cli/script/brain-completion.ps1"
#   3. 临时使用（在仓库根目录下）:
#        . ./brain-cli/script/brain-completion.ps1

Register-ArgumentCompleter -Native -CommandName @('brain', 'brain.ps1', 'brain.cmd', 'brain.exe') -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    # 子命令树
    $tree = @{
        ''        = @('init', 'status', 'capture', 'new', 'backup', 'watch', 'review', 'rename', 'move', 'links', 'backlinks', 'web', '--help', '--version')
        'watch'   = @('start', 'stop', 'status', '--help')
        'review'  = @('week', 'month', 'tags', 'random', '--help')
        'capture' = @('--content', '--tags', '--type', '--help')
        'new'     = @('--content', '--tags', '--type', '--help')
        'backup'  = @('--message', '--push', '--help')
        'rename'  = @('--dry-run', '--help')
        'move'    = @('--dry-run', '--help')
        'links'   = @('--check', '--json', '--orphans', '--stats', '--scope', '--write', '--help')
        'web'     = @('--open', '--port', '--help')
    }

    # 选项的可选值
    $values = @{
        '--scope' = @('active', 'all')
        '--type'  = @('Fleeting', 'Literature', 'Permanent', 'Project')
    }

    # 解析已经输入的 token（去掉 'brain' 自身）
    $tokens = $commandAst.CommandElements |
        ForEach-Object { $_.Extent.Text } |
        Select-Object -Skip 1
    # 去掉最后一个正在输入的 token
    $typedArgs = @($tokens | Select-Object -SkipLast 1)

    # 上一个 token 是需要值的选项时，补全选项值
    $prev = $typedArgs | Select-Object -Last 1
    if ($prev -and $values.ContainsKey($prev)) {
        $values[$prev] |
            Where-Object { $_ -like "$wordToComplete*" } |
            ForEach-Object {
                [System.Management.Automation.CompletionResult]::new(
                    $_, $_, 'ParameterValue', $_
                )
            }
        return
    }

    # 选择当前层级
    $positional = @($typedArgs | Where-Object { $_ -notmatch '^-' })
    $key = ''
    if ($positional.Count -ge 1 -and $tree.ContainsKey($positional[0])) {
        $key = $positional[0]
    }

    $candidates = $tree[$key]
    if (-not $candidates) { return }

    $candidates |
        Where-Object { $_ -like "$wordToComplete*" } |
        Sort-Object |
        ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_, $_, 'ParameterValue', $_
            )
        }
}
