# ark

新しいマシンを 1 コマンドで「いつもの環境」にし、以降も同じコマンドで同じ状態に保つための個人用の
セットアップリポジトリ。macOS / Linux（WSL）/ native Windows のマシン構成を宣言として持ち、実行の
たびに宣言へ冪等に収束させる。何度流しても結果は同じで、宣言と実機の差分だけが反映される。

管理対象は **パッケージ / dotfiles / 自前コマンド**。

## クイックスタート

macOS / Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/muyuu/ark/main/bootstrap.sh | bash
```

Windows（PowerShell）:

```powershell
irm https://raw.githubusercontent.com/muyuu/ark/main/bootstrap.ps1 | iex
```

bootstrap が toolchain（Homebrew / mise / Deno）を用意し、以降は engine（Deno + TypeScript）が
宣言を適用する。

## 使い方

```sh
ark            # タスク一覧
ark update     # core/overlay を最新化して適用する（普段はこれ）
ark audit      # 宣言に無いのに入っているパッケージを棚卸しする
```

コマンド一覧と「パッケージ / dotfile を足したいとき」の手順は
**[docs/usage.md](docs/usage.md)** にまとめてある。

公開できない設定（業務用・個人用）は private repo を「overlay」として重ねられる:

```sh
ark overlay add muyuu/ark-personal
```

## 構成

```
bootstrap.sh / bootstrap.ps1   # 唯一の shell 入口
engine/                        # install / update / audit のロジック（Deno + TypeScript）
app/                           # パッケージ manifest（common / macos / linux / windows）
config/                        # dotfiles
command/                       # 自前コマンド（Rust）
```

## 開発

```sh
ark test && ark check && ark lint
```

詳細は [docs/development.md](docs/development.md)。

## ドキュメント

|                                              |                      |
| -------------------------------------------- | -------------------- |
| [docs/usage.md](docs/usage.md)               | コマンドと日常の操作 |
| [docs/architecture.md](docs/architecture.md) | 構成と仕組み         |
| [docs/decisions.md](docs/decisions.md)       | なぜその構成なのか   |
| [docs/development.md](docs/development.md)   | ark 自体を直す人向け |
