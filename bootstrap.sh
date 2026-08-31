#!/usr/bin/env bash
set -euo pipefail

# 唯一の shell 入口。deno が立ち上がる前の最小限（toolchain 用意・リポジトリ取得・PATH 通し）だけを
# shell で行い、以降は engine（Deno + TS）へ委譲する。core は public なので認証なしで取得できる。
# brew / mise をこのプロセス内で PATH に通すので、再ログインせずに install まで一気に完了する。
#
#   curl -fsSL https://raw.githubusercontent.com/muyuu/ark/main/bootstrap.sh | bash
#   （clone 済みなら）./bootstrap.sh
#   （自動化から）./bootstrap.sh --strict   … 導入に失敗した物があれば 0 以外で終了する

# clone 済みならスクリプト位置、未取得（curl | bash 経由）なら既定パスへ
if [ -n "${BASH_SOURCE:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  ARK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  ARK_DIR="$HOME/workspaces/github.com/muyuu/ark"
fi

# WSL では日本語ロケールを用意する
if [ -f /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then
  echo "🐧 WSL 環境を検出しました。日本語ロケールを設定します..."
  sudo apt update
  sudo apt install -y language-pack-ja
  sudo update-locale LANG=ja_JP.UTF-8
fi

# fresh な Linux（WSL 含む）は git / curl が未導入のことがある。clone・以降の取得の前に用意する。
if [ "$(uname)" = "Linux" ]; then
  for tool in git curl; do
    command -v "$tool" >/dev/null 2>&1 && continue
    echo "📦 $tool をインストールします..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update && sudo apt-get install -y "$tool"
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y "$tool"
    elif command -v pacman >/dev/null 2>&1; then
      sudo pacman -S --noconfirm "$tool"
    fi
  done
fi

# ark を HTTPS でクローン（SSH 鍵が未登録でも可）。取得済みなら最新へ更新する。
if [ ! -d "$ARK_DIR/.git" ]; then
  echo "📦 ark リポジトリをクローンしています..."
  mkdir -p "$(dirname "$ARK_DIR")"
  git clone https://github.com/muyuu/ark.git "$ARK_DIR"
else
  echo "🔄 ark を最新へ更新します..."
  git -C "$ARK_DIR" pull --ff-only || true
fi

cd "$ARK_DIR"

# サーバ（表示先の無い Linux。WSL は除く）には Homebrew を入れない。CLI ツールは開発機だけの層で、
# サーバは distro PM の最小限で足りる（docs/architecture.md のサポート範囲を参照）。
# 判定は engine の isServerEnv と同じ条件を shell で書いたもの。
is_server() {
  [ "$(uname)" = "Linux" ] || return 1
  if [ -f /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then
    return 1
  fi
  [ -z "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ]
}

# Homebrew
if is_server; then
  echo "🖥 サーバを検出しました。Homebrew は入れません"
elif ! command -v brew >/dev/null 2>&1; then
  echo "🍺 Homebrew をインストールします..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# brew をこのプロセスの PATH に通す（インストール直後は PATH に乗らないため）
if ! command -v brew >/dev/null 2>&1; then
  for prefix in /opt/homebrew /home/linuxbrew/.linuxbrew "$HOME/.linuxbrew" /usr/local; do
    if [ -x "$prefix/bin/brew" ]; then
      eval "$("$prefix/bin/brew" shellenv)"
      break
    fi
  done
fi

# mise
if ! command -v mise >/dev/null 2>&1; then
  echo "🔧 mise をインストールします..."
  curl https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$PATH"

# リポジトリの mise 設定（tasks / tool pin）を信頼し、toolchain（deno / rust）を用意する
mise trust "$ARK_DIR/mise.toml" >/dev/null 2>&1 || true
echo "🦕 toolchain（deno / rust）を用意しています..."
mise install

# 先に core の dotfiles を展開する（~/.gitconfig の ghq.root 等を有効化してから overlay を取得するため）
echo "▶ 環境を設定しています（PATH / dotfiles）..."
mise exec deno -- deno run -A "$ARK_DIR/engine/bootstrap.ts"

# private overlay を使う場合だけ、GitHub 認証と SSH 鍵を用意してから取得し、もう一度 dotfiles を展開する。
# overlays.toml が無ければ core だけで完結する。
if [ -f "$HOME/.config/ark/overlays.toml" ]; then
  command -v gh >/dev/null 2>&1 || brew install gh
  if ! gh auth status >/dev/null 2>&1; then
    if [ -e /dev/tty ]; then
      echo "▶ GitHub にログインします（ブラウザ認証）..."
      gh auth login --git-protocol ssh --web </dev/tty
    else
      echo "⚠ 非対話環境のため GitHub ログインをスキップします（overlay は取得できません）"
    fi
  fi
  echo "🔑 github.com 用の SSH 鍵を用意して登録しています..."
  mise exec deno -- deno run -A "$ARK_DIR/engine/setup-github.ts"
  echo "▶ overlay を取得しています..."
  mise exec deno -- deno run -A "$ARK_DIR/engine/overlay-sync.ts"
  echo "🔑 宣言された SSH 鍵を揃えています..."
  mise exec deno -- deno run -A "$ARK_DIR/engine/ssh-keys.ts"
  echo "▶ overlay の dotfiles を展開しています..."
  mise exec deno -- deno run -A "$ARK_DIR/engine/bootstrap.ts"
fi

echo "▶ パッケージと自前コマンドを導入しています..."
# 引数はそのまま install へ渡す（--strict で失敗があれば 0 以外で終了する）
mise exec deno -- deno run -A "$ARK_DIR/engine/install.ts" "$@"

echo "✅ セットアップ完了。新しいシェルを開くと zsh と PATH が反映されます。"
echo "   以降の更新は 'mise run install'、dotfiles の再展開は 'mise run link-dotfiles'。"
