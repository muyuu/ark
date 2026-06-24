# ========================================
# エイリアス設定
# ========================================

alias relogin='exec $SHELL -l'

# replace command line tool
alias ds='dust'
alias grep='rg'

if hash eza 2>/dev/null; then
    alias eza='eza --group-directories-first --git'
    alias ls='eza'
    alias ll='eza -lahB'
    alias lt='ll --tree --git-ignore'
else
    alias l='ls -lah'
    alias ll='ls -alF'
    alias la='ls -A'
fi

alias gs='git status -sb'
alias commit='git commit'
alias add='git add'
alias reset='git checkout HEAD'
alias co='git checkout'
alias cob='git checkout -b'
alias push='git push'
alias pull='git pull'
alias fetch='git fetch'
alias merge='git merge --no-ff'

# ffmpegエイリアス
alias ffmpeg='ffmpeg -hide_banner'
alias ffprobe='ffprobe -hide_banner'

# MP4Boxエイリアス
alias MP4Box='docker run --rm -v `pwd`:/work sambaiz/mp4box'

# cd したら ls
# via http://d.hatena.ne.jp/toshifumi_tegu/20090510/1241962412
# 対話シェルのみで実行する。非対話シェル（Claude Code 等の `zsh -c`）では
# `eza --git` が worktree の git スキャンで固まり、同時実行の git commit 等を
# 巻き込んでハングするため走らせない。
function chpwd() { [[ -o interactive ]] && ls -lah }

# ディレクトリを作成して移動
function mkcd(){mkdir -p $1 && cd $1}

# ローカルリポジトリに移動
alias g='cd $(ghq root)/$(ghq list | fzf)'

# fzfでコマンド履歴を使う
function fzf-history-selection() {
    local cmd=$(fc -ln 1 | awk '{lines[NR]=$0} END{for(i=NR;i>=1;i--)if(!a[lines[i]]++)print lines[i]}' | fzf --height 40% --reverse)
    if [ -n "$cmd" ]; then
        BUFFER="$cmd"
        CURSOR=$#BUFFER
    fi
    zle reset-prompt
}

zle -N fzf-history-selection
bindkey '^r' fzf-history-selection

# ========================================
# fzf でサスペンドしたジョブを選択して fg
# ========================================
# 複数の C-z したジョブがある時に fg %1 等と番号指定するのが面倒なので
# fzf で選択できるようにする
# ジョブが1つなら通常の fg、複数なら fzf で選択
function fg() {
  local job_count=$(jobs | wc -l | tr -d ' ')

  # ジョブがなければ何もしない
  if [[ "$job_count" -eq 0 ]]; then
    echo "fg: no current job"
    return 1
  fi

  # ジョブが1つなら通常の fg
  if [[ "$job_count" -eq 1 ]]; then
    builtin fg
    return
  fi

  # 複数ジョブがある場合は fzf で選択
  # jobs の出力例: [1]  + suspended  nvim
  local selected=$(jobs | fzf --height 40% --reverse --header "Select job to foreground")
  if [[ -n "$selected" ]]; then
    # [1] の数字部分を抽出
    local job_num=$(echo "$selected" | sed 's/^\[\([0-9]*\)\].*/\1/')
    builtin fg %$job_num
  fi
}
