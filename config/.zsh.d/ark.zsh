# ========================================
# ark: 開発環境セットアップの入口
# ========================================
# ark リポジトリで mise タスクを実行する薄いラッパ。どこからでも叩ける。
#   ark            タスク一覧
#   ark update     追加分の導入＋既存の更新
#   ark <task> …   その他のタスク（mise run <task> に委譲）
# リポジトリの場所は ARK_DIR で上書きできる。

function ark() {
  emulate -L zsh
  local repo="${ARK_DIR:-$HOME/workspaces/github.com/muyuu/ark}"
  if [[ ! -d "$repo" ]]; then
    print -u2 "ark: リポジトリが見つかりません: $repo"
    return 1
  fi
  if (( $# == 0 )); then
    ( cd "$repo" && mise tasks )
  else
    ( cd "$repo" && mise run "$@" )
  fi
}
