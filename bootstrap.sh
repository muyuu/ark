#!/usr/bin/env bash
set -euo pipefail

# 唯一の shell 入口。deno が立ち上がる前の最小限（toolchain 用意・リポジトリ取得・PATH 通し）だけを
# shell で行い、以降は engine（Deno + TS）へ委譲する。core は public なので認証なしで取得できる。
# brew / mise をこのプロセス内で PATH に通すので、再ログインせずに install まで一気に完了する。
#
#   curl -fsSL https://raw.githubusercontent.com/muyuu/ark/main/bootstrap.sh | bash
#   （clone 済みなら）./bootstrap.sh

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

# ark を HTTPS でクローン（SSH 鍵が未登録でも可）。取得済みなら何もしない
if [ ! -d "$ARK_DIR/.git" ]; then
  echo "📦 ark リポジトリをクローンしています..."
  mkdir -p "$(dirname "$ARK_DIR")"
  git clone https://github.com/muyuu/ark.git "$ARK_DIR"
fi

cd "$ARK_DIR"

# Homebrew
if ! command -v brew >/dev/null 2>&1; then
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

# 環境設定（PATH / dotfiles）→ パッケージ・自前コマンド導入まで同一実行で完了させる
echo "▶ 環境を設定しています（PATH / dotfiles）..."
mise exec deno -- deno run -A "$ARK_DIR/engine/bootstrap.ts"

echo "▶ パッケージと自前コマンドを導入しています..."
mise exec deno -- deno run -A "$ARK_DIR/engine/install.ts"

echo "✅ セットアップ完了。新しいシェルを開くと zsh と PATH が反映されます。"
echo "   以降の更新は 'mise run install'、dotfiles の再展開は 'mise run link-dotfiles'。"
