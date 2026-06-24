# 補完機能を有効にする
autoload -Uz compinit
compinit

# 補完でカラーを使用する
autoload colors
zstyle ':completion:*' list-colors "${LS_COLORS}"

# cd したら自動的にpushdする
setopt auto_pushd
# 重複したディレクトリを追加しない
setopt pushd_ignore_dups

# ヒストリの設定
HISTFILE=~/.zsh_history
HISTSIZE=1000000
SAVEHIST=1000000
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_FIND_NO_DUPS
setopt HIST_SAVE_NO_DUPS

# emacs 風キーバインドにする
bindkey -e

# その他とりあえずいるもの
export LANG=ja_JP.UTF-8

# 日本語ファイル名を表示可能にする
setopt print_eight_bit

# フローコントロールを無効にする
setopt no_flow_control

# '#' 以降をコメントとして扱う
setopt interactive_comments

# 色の設定
export LSCOLORS=Exfxcxdxbxegedabagacad
# 補完時の色の設定
export LS_COLORS='di=01;34:ln=01;35:so=01;32:ex=01;31:bd=46;34:cd=43;34:su=41;30:sg=46;30:tw=42;30:ow=43;30'
# ZLS_COLORSとは？
export ZLS_COLORS=$LS_COLORS
# lsコマンド時、自動で色がつく(ls -Gのようなもの？)
export CLICOLOR=true
# 補完候補に色を付ける
zstyle ':completion:*:default' list-colors ${(s.:.)LS_COLORS}

zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'

# プロンプト設定
autoload colors
autoload -Uz vcs_info
colors

zstyle ':vcs_info:*' enable git svn
zstyle ':vcs_info:*' max-exports 6 # formatに入る変数の最大数
zstyle ':vcs_info:git:*' check-for-changes true
zstyle ':vcs_info:git:*' formats '%b@%r' '%c' '%u'
zstyle ':vcs_info:git:*' actionformats '%b@%r|%a' '%c' '%u'
setopt prompt_subst
function vcs_echo {
    local st branch color
    # zsh の関数定義パスが一時的に壊れている場合は黙って無効化する
    autoload -Uz +X vcs_info 2>/dev/null || return
    STY= LANG=en_US.UTF-8 vcs_info
    st=`git status 2> /dev/null`
    if [[ -z "$st" ]]; then return; fi
    branch="$vcs_info_msg_0_"
    if   [[ -n "$vcs_info_msg_1_" ]]; then color=${fg[green]} #staged
    elif [[ -n "$vcs_info_msg_2_" ]]; then color=${fg[red]} #unstaged
    elif [[ -n `echo "$st" | grep "^Untracked"` ]]; then color=${fg[blue]} # untracked
    else color=${fg[cyan]}
    fi
    echo " %{$color%}%{$branch%}%{$reset_color%}" | sed -e s/@/"%F{yellow}@%f%{$color%}"/
}


PROMPT='
%D %* JST %F{yellow}%~%f`vcs_echo`
%(?.%F{red}❱%f%F{yellow}❱%f%F{green}❱%f.%F{red}❱%f%F{yellow}❱%f%F{green}❱%f) '

# ディレクトリ名を入力するだけで移動
setopt auto_cd

# もしかして機能
setopt correct

# PCRE 互換の正規表現を使う
# setopt re_match_pcre

# プロンプトが表示されるたびにプロンプト文字列を評価、置換する
setopt prompt_subst

# プロンプト指定(コマンドの続き)
PROMPT2='[%n]> '

# もしかして時のプロンプト指定
SPROMPT='\
%{$fg[red]%}%{$suggest%}${reset_color}Maybe %B%r%b ? \
%{$fg[green]%}Yes(y)${reset_color}, \
%{$fg[yellow]%}No(n)${reset_color}'
