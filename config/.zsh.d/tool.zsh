# ========================================
# ツール・パス設定・セットアップ
# ========================================

# Homebrew設定
system_info=$(uname)
if [ "$system_info" = "Darwin" ]; then
    # for M1 Mac
    export PATH=/opt/homebrew/bin:$PATH
    export PATH=/opt/homebrew/sbin:$PATH
elif [ "$system_info" = 'Linux' ]; then
    if [[ "$(uname -r)" = *microsoft* ]]; then
        # for WSL2
        eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    fi
fi

# mise設定
export PATH="$HOME/.local/bin:$PATH"
eval "$(mise activate zsh)"

# Go設定
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"

# iTerm2設定
if [ $ITERM_SESSION_ID ]; then
  export PROMPT_COMMAND='echo -ne "\033];${PWD##*/}\007"; ':"$PROMPT_COMMAND";
fi
