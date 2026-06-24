# ark

macOS / Linux（WSL）/ native Windows それぞれのマシン構成を宣言として持ち、実行のたびに宣言した状態へ
冪等に収束させる。何度流しても結果は同じで、宣言と実機の差分だけが反映される。

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

bootstrap が toolchain を用意し、以降は engine（Deno + TS）へ委譲する。

## 構成

```
bootstrap.sh / bootstrap.ps1   # 唯一の shell 入口
engine/                        # install / update / audit / bootstrap ロジック（Deno + TS）
app/                           # パッケージ manifest（common / macos / linux / windows）
config/                        # dotfiles
command/                       # 自前コマンド（Rust）
```

## overlay（任意）

private repo を重ねれば、core に置けない設定（業務用・個人用など）を同じ仕組みで足せる。bootstrap 後に:

```sh
ark overlay add muyuu/ark-personal   # 登録 → GitHub 認証 → ghq ツリーへ取得
ark update                           # core/overlay を最新化して適用
```

`overlay add` は `owner/repo` でも完全な git URL でも指定できる。登録は machine-local の
`~/.config/ark/overlays.toml` に書かれ、以降 `ark update` で取得・合成される。

## ドキュメント

- [docs/architecture.md](docs/architecture.md) — 構成
- [docs/decisions.md](docs/decisions.md) — 設計判断
