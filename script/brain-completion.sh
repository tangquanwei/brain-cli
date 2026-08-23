#!/bin/bash

# 2nd Brain CLI — Bash/Zsh tab completion
#
# 安装方法（任选其一）:
#   1. 运行 brain-cli/script/install.sh，按提示自动写入 ~/.bashrc 或 ~/.zshrc
#   2. 手动在你的 ~/.bashrc / ~/.zshrc 中添加:
#        source <仓库根目录>/brain-cli/script/brain-completion.sh
#   3. 临时使用:
#        source brain-cli/script/brain-completion.sh

_brain_completions() {
    local cur_word prev_word
    cur_word="${COMP_WORDS[COMP_CWORD]}"
    prev_word="${COMP_WORDS[COMP_CWORD-1]}"

    local commands="init status capture new backup watch review rename move links backlinks web --help --version"
    local watch_commands="start stop status --help"
    local review_commands="week month tags random --help"
    local capture_options="--content --tags --type --help"
    local backup_options="--message --push --help"
    local rename_options="--dry-run --help"
    local move_options="--dry-run --help"
    local links_options="--check --json --orphans --stats --scope --write --help"
    local links_scope_values="active all"
    local capture_type_values="Fleeting Literature Permanent Project"
    local web_options="--open --port --help"

    # 主命令
    if [[ ${COMP_CWORD} == 1 ]]; then
        COMPREPLY=($(compgen -W "${commands}" -- "${cur_word}"))
        return 0
    fi

    # 需要值的选项
    case "${prev_word}" in
        --scope)
            COMPREPLY=($(compgen -W "${links_scope_values}" -- "${cur_word}"))
            return 0
            ;;
        --type)
            COMPREPLY=($(compgen -W "${capture_type_values}" -- "${cur_word}"))
            return 0
            ;;
    esac

    # 子命令
    case "${prev_word}" in
        watch)
            COMPREPLY=($(compgen -W "${watch_commands}" -- "${cur_word}"))
            return 0
            ;;
        review)
            COMPREPLY=($(compgen -W "${review_commands}" -- "${cur_word}"))
            return 0
            ;;
        capture|new)
            COMPREPLY=($(compgen -W "${capture_options}" -- "${cur_word}"))
            return 0
            ;;
        backup)
            COMPREPLY=($(compgen -W "${backup_options}" -- "${cur_word}"))
            return 0
            ;;
        rename)
            COMPREPLY=($(compgen -W "${rename_options}" -- "${cur_word}"))
            return 0
            ;;
        move)
            COMPREPLY=($(compgen -W "${move_options}" -- "${cur_word}"))
            return 0
            ;;
        links)
            COMPREPLY=($(compgen -W "${links_options}" -- "${cur_word}"))
            return 0
            ;;
        web)
            COMPREPLY=($(compgen -W "${web_options}" -- "${cur_word}"))
            return 0
            ;;
        *)
            ;;
    esac

    COMPREPLY=()
}

complete -F _brain_completions brain
