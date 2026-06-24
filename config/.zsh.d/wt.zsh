# ========================================
# wt: git worktree + sandbox manager
# ========================================
# 実体は Rust 製 CLI（ark/wt/）。この関数はそれを呼ぶだけの薄いシム。
# バイナリの場所は WT_BIN で上書きできる（既定はビルド成果物）。
#   ビルド: cd ~/workspaces/github.com/muyuu/ark/wt && cargo build --release

function wt() {
  emulate -L zsh
  local bin="${WT_BIN:-$HOME/workspaces/github.com/muyuu/ark/wt/target/release/wt}"
  if [[ ! -x "$bin" ]]; then
    print -u2 "wt: バイナリ未ビルド: $bin"
    print -u2 "    cd ~/workspaces/github.com/muyuu/ark/wt && cargo build --release"
    return 1
  fi
  "$bin" "$@"
}
