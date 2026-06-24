# アーキテクチャ

ark の構成。設計判断の理由は [decisions.md](./decisions.md) を参照。

## 全体像

ark は macOS / Linux（WSL）/ native Windows それぞれのマシン構成を宣言として持ち、実行のたびに宣言した
状態へ冪等に収束させる。初回セットアップも以降の更新も同じ経路で、宣言と実機の差分だけが反映される。
管理対象は **パッケージ / dotfiles / 自前コマンド** の 3 つ。

## ディレクトリ構成

```
/
  bootstrap.sh / bootstrap.ps1   # 唯一の shell 入口
  engine/                        # install / update / audit / bootstrap ロジック（Deno + TS）
  app/                           # パッケージ manifest
    common/  macos/  linux/  windows/
  config/                        # dotfiles
  command/                       # 自前コマンド（Rust）
```

## bootstrap

3 OS とも「唯一の shell 入口が toolchain だけ用意し、以降は engine（Deno + TS）へ委譲する」薄い形。

- 入口: macOS/Linux `curl … | bash`、Windows `irm … | iex`。core は public なので取得に認証は要らない。
- **対話プロンプトは `< /dev/tty` から読む**（`curl … | bash` は stdin がパイプで対話入力を奪うため）。
  tty が無い環境（CI 等）は非対話フォールバックへ落ちる。

## パッケージ（app/）

宣言は OS 別の manifest に置く（`common` は macOS/Linux 共通）。導入対象は OS と環境（GUI の有無など）で
決まり、GUI 向けの宣言は GUI を持つ環境にだけ適用される（環境は自動判定で、手動フラグは持たない）。

winget/Store に載らない「野良」アプリは段階で扱う: ①宣言（manifest）→ ②custom（engine の個別インストーラ）
→ ③manual-tracked（記録のみ・audit で欠落検知）。

## dotfiles（config/）

`config/` 配下を `$HOME` へ symlink で展開する。対象は 2 種類に分けて扱う。

- **単一所有のファイル**（`.zshrc` / `.gitconfig` / `.vimrc` / `.editorconfig` など）はそのファイルを
  `$HOME` 直下へリンクする。overlay はこれらを置き換えず in-band で拡張する（`.zshrc` は `.zsh.d/*` を
  glob source、`.gitconfig` は `includeIf`、`.claude/CLAUDE.md` は `@import`）。
- **マージ対象のディレクトリ**（`.zsh.d` / `.config` / `.claude`）は自身ではなく**中身（子）を個別リンク**
  する。`$HOME` 側を実ディレクトリに保ち、core と各 overlay が同じディレクトリへ自分のファイルを落とせる
  ようにするため（`.config` / `.claude` はランタイム状態とも混ざるので個別リンクが必須）。
- 同名の子が複数 layer にあれば後の layer（overlay）が勝つ。既存が実ファイルなら `<target>.bak.<epoch>` へ
  退避してからリンクする。

## command（command/）

自前コマンドを 1 つ 1 サブディレクトリ（`command/<name>/`）に置く。各コマンドは独立した自己完結プロジェクトで、
言語は問わない（`command/` 自体はただの入れ物）。

- ビルドは build-on-target。bootstrap が `command/*` を種類に応じて個別にビルドし（例: `Cargo.toml` なら
  `cargo build --release`）、生成物を `~/.local/bin` に置く。
- Rust コマンドは mac/Linux は標準のリンカでビルド可。**Windows は既定でビルドをスキップ**し、必要なときだけ
  opt-in する（rust(MSVC) のリンカ前提を避けるため）。

## audit

`ark audit` は宣言と実機の差分を検知する。overlay を使っている場合は有効な overlay の宣言も対象に含める。

## overlay（任意）

private repo を重ねて、core に置けない設定（公開できない秘匿・業務情報など）を足せる仕組み。

- 登録は machine-local: `~/.config/ark/overlays.toml`（repo には入れない）。

  ```toml
  [[overlay]]
  name = "work"
  url  = "git@github.com:<work-org>/ark-work.git"
  ```
- overlay リポは `app/` と `config/` だけを持つ純コンテンツ。engine は core にしか無い。
- 取得には GitHub 認証が要る。bootstrap が core 適用後に `gh auth login --git-protocol ssh --web` で認証を
  確立し、SSH 鍵を登録してから overlay を clone する。clone 先は `~/.config/ark/overlays/<name>/`。
- 合成順は core → overlay（配列順）。衝突は後勝ちだが、実態はほぼファイル追加。複雑なマージは避け、git と
  ツールの標準機構に寄せる:

  | 対象                | 仕組み                                                 |
  | ------------------- | ------------------------------------------------------ |
  | `.gitconfig`        | core の値に `includeIf "gitdir:…"` で追加の設定を差す  |
  | `.claude/CLAUDE.md` | 末尾の `@~/.claude/<name>.md`（あれば import）に逃がす |
  | `.zsh.d/*.zsh`      | glob source。overlay はファイルを置くだけ              |

- 使い分けの例: 業務用 `ark-work`（職場 org に置けば同僚と共有可）、個人用 `ark-personal`。
