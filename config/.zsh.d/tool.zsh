# ========================================
# ツール・パス設定・セットアップ
# ========================================

# Homebrew設定
# brew を入れないマシン（サーバ等）もあるので、実体があるときだけ活性化する。
system_info=$(uname)
if [ "$system_info" = "Darwin" ]; then
    # for M1 Mac
    export PATH=/opt/homebrew/bin:$PATH
    export PATH=/opt/homebrew/sbin:$PATH
elif [ "$system_info" = 'Linux' ]; then
    for brew_prefix in /home/linuxbrew/.linuxbrew "$HOME/.linuxbrew"; do
        if [ -x "$brew_prefix/bin/brew" ]; then
            eval "$("$brew_prefix/bin/brew" shellenv)"
            break
        fi
    done
fi

# mise設定
export PATH="$HOME/.local/bin:$PATH"
hash mise 2>/dev/null && eval "$(mise activate zsh)"

# Go設定
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"

# iTerm2設定
if [ $ITERM_SESSION_ID ]; then
  export PROMPT_COMMAND='echo -ne "\033];${PWD##*/}\007"; ':"$PROMPT_COMMAND";
fi
