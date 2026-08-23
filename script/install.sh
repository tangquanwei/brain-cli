#!/bin/bash
set -e

# 定位仓库根目录：优先用 git 探测（脚本放在仓库任意层级都可以），
# 失败时回退到脚本上两级（script/ -> brain-cli/ -> 仓库根目录）
ROOT_DIR="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT_DIR" ]; then
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
cd "$ROOT_DIR"

echo -e "\033[1;36m🚀 开始安装 2ndBrain 系统运行环境...\033[0m"

# 1. 检查前置依赖
if ! command -v npm &> /dev/null; then
    echo -e "\033[1;31m❌ 未找到 npm！请先安装 Node.js (建议 >= 20.0)\033[0m"
    exit 1
fi
if ! command -v git &> /dev/null; then
    echo -e "\033[1;31m❌ 未找到 Git！请先安装 Git\033[0m"
    exit 1
fi

# 2. 初始化三个仓库及 blog 内部主题子模块
echo -e "\n\033[1;33m📦 [1/3] 初始化 blog、notes 和 Butterfly 子模块...\033[0m"
git submodule update --init --recursive

# 3. 安装 Hexo 博客依赖
echo -e "\n\033[1;33m📝 [2/3] 安装 blog 依赖...\033[0m"
if [ -d "blog" ]; then
    npm --prefix blog install
else
    echo -e "\033[1;31m⚠️ 未找到 blog 子模块，跳过博客依赖安装。\033[0m"
fi

# 4. 安装与构建 Brain CLI
echo -e "\n\033[1;33m🧠 [3/3] 正在安装与构建本地工作流 CLI (brain-cli)...\033[0m"
if [ -d "brain-cli" ]; then
    cd brain-cli
    npm install
    echo -e "\033[1;36m🔨 编译 TypeScript CLI...\033[0m"
    npm run build
    echo -e "\033[1;36m🔗 正在注册全局 brain 命令...\033[0m"
    npm link
    cd ..
else
    echo -e "\033[1;31m⚠️ 未找到 brain-cli 目录，跳过 CLI 安装。\033[0m"
fi

echo -e "\n\033[1;33m🛠 配置命令自动补全...\033[0m"
read -p "是否要将 brain 命令补全添加到 ~/.bashrc 或 ~/.zshrc? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    COMPLETION_SOURCE="source \"$ROOT_DIR/brain-cli/script/brain-completion.sh\""
    
    # zsh
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q "brain-completion.sh" "$HOME/.zshrc"; then
            echo "" >> "$HOME/.zshrc"
            echo "# 2ndBrain CLI completion" >> "$HOME/.zshrc"
            echo "$COMPLETION_SOURCE" >> "$HOME/.zshrc"
            echo -e "\033[1;32m✅ 已添加到 ~/.zshrc\033[0m"
        else
            echo -e "\033[1;33m⚠️ ~/.zshrc 中已存在该配置\033[0m"
        fi
    fi
    
    # bash
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "brain-completion.sh" "$HOME/.bashrc"; then
            echo "" >> "$HOME/.bashrc"
            echo "# 2ndBrain CLI completion" >> "$HOME/.bashrc"
            echo "$COMPLETION_SOURCE" >> "$HOME/.bashrc"
            echo -e "\033[1;32m✅ 已添加到 ~/.bashrc\033[0m"
        else
            echo -e "\033[1;33m⚠️ ~/.bashrc 中已存在该配置\033[0m"
        fi
    fi
    echo -e "\033[1;36m💡 请打开新终端，或运行 'source ~/.zshrc' / 'source ~/.bashrc' 使其生效。\033[0m"
fi

echo -e "\n\033[1;32m🎉 全部环境安装&配置完成！\033[0m"
echo -e "\033[1;36m👉 你现在可以运行:\033[0m"
echo -e "   \033[1;37mbrain init\033[0m    - 检查并初始化知识库"
echo -e "   \033[1;37mbrain status\033[0m  - 查看第二大脑当前状态"
echo -e "   \033[1;37mnpm --prefix blog run server\033[0m - 启动本地 Hexo 预览服务"
