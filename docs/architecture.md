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
- **サーバでは Homebrew を入れない**（表示先の無い Linux を検出して飛ばす）。CLI ツールは開発機だけの層。
- **対話プロンプトは `< /dev/tty` から読む**（`curl … | bash` は stdin がパイプで対話入力を奪うため）。
  tty が無い環境（CI 等）は非対話フォールバックへ落ちる。

## SSH 鍵

鍵はマシンの資産として持ち、GitHub はその登録先の 1 つとして扱う。用意（`ark ssh-keys`）と GitHub への
登録（`ark github`）は別のコマンドに分かれる。

- 宣言は `[[key]]` の配列。`name` が鍵の識別子でファイル名を導き（`default` だけは ssh のデフォルト ID
  `~/.ssh/id_ed25519`、それ以外は `~/.ssh/id_ed25519_<name>`）、`host` を書くとその Host へ鍵を固定する
  ブロックを `~/.ssh/config` に追記する（`hostname` でエイリアスから実ホストへ向けられる）。
- 合成順は 既定 → machine-local（`~/.config/ark/ssh-keys.toml`）→ overlay（`<overlay>/ssh-keys.toml`・
  登録順）。同名は後勝ち。
- 宣言が無いマシンは既定の 1 本（`default` を github.com へ）だけを持つ。1 マシン 1 本か用途別に複数かは
  宣言で決める。
- **bootstrap に要る鍵（github.com 用）は overlay に宣言できない。** overlay 自体を SSH で引くのに要るため、
  machine-local か既定のどちらかで持つ。
- GitHub への自動登録は既定鍵だけ。用途別の鍵は登録先アカウントの選択を伴うので、`gh` の認証を切り替えた
  うえで明示的に登録する。

## サポート範囲

どの環境で何を面倒みるかを先に決めてある。空欄を作らないのが目的で、「やらない」も宣言のうち。

|                     | パッケージ             | dotfiles                                 | 自前コマンド     | デスクトップ層 |
| ------------------- | ---------------------- | ---------------------------------------- | ---------------- | -------------- |
| macOS               | brew                   | 全部                                     | ビルドする       | 入れる         |
| Linux（GUI）        | brew + distro PM       | 全部                                     | ビルドする       | 入れる         |
| WSL                 | brew + distro PM       | 全部                                     | ビルドする       | **入れない**   |
| native Windows      | winget                 | `.gitconfig` / `.config/tig` / `.claude` | **ビルドしない** | 入れる         |
| Linux サーバ（VPS） | distro PM の最小層のみ | 全部                                     | ビルドする       | **入れない**   |

WSL・native Windows・サーバの位置づけ:

- **WSL は開発環境**（web と Rust）。WSLg で GUI は動くが、ブラウザ・ファイルマネージャ・IME と
  いったデスクトップの道具はホストの Windows 側にあるので入れない。開発に要るエディタ（Zed）だけは
  デスクトップ層ではなく開発層に置く。
- **native Windows でも Rust のビルド・実行はする**（母艦は WSL）。CLI は toolchain と ghq に絞り、
  便利 CLI は WSL 側で使う。dotfiles は native Windows で実際に読まれる物だけを展開する。
- **Linux サーバ（VPS）ではホストの構成を持たない。** OS の設定・ファイアウォール・Docker・鍵の配布は
  [keel](https://github.com/muyuu/keel)（Ansible）が持ち、ark は操作者の環境（dotfiles と、ssh して
  中を見て git を触るための最小パッケージ）だけを見る。ark を呼ぶのも keel。brew も入れない——bootstrap が表示先の無い Linux を検出して飛ばす。
- ark 自身の `command/`（Rust）は unix API を使うため native Windows ではビルドしない。

## パッケージ（app/）

宣言は OS 別の manifest に置く（`common` は macOS/Linux 共通）。導入対象は OS と環境で決まり、環境は
自動判定する（手動フラグは持たない）。最小層はどこでも適用し、そのうえで用途別の層を 1 つ重ねる（サーバ層と開発層は排他）:

| 層             | manifest                                                     | 適用先                  |
| -------------- | ------------------------------------------------------------ | ----------------------- |
| 最小           | `packages` / `custom.toml` / `winget_cli`                    | すべての環境            |
| サーバ層       | `server` / `custom-server.toml`                              | 表示先の無い Linux のみ |
| 開発層         | `common`(Brewfile) / `dev` / `custom-dev.toml`               | デスクトップと WSL      |
| デスクトップ層 | `desktop` / `flatpak` / `custom-desktop.toml` / `winget_gui` | デスクトップ環境のみ    |

- **デスクトップ環境**: macOS・Windows なら常に真。Linux は WSL でなく、かつ表示先（`DISPLAY` /
  `WAYLAND_DISPLAY`）がある。
- **開発機**: デスクトップ、または WSL。
- **サーバ**: 開発機の裏返し（表示先の無い Linux）。「人が作業する場所」ではなく「サービスを載せる箱」。

### package manager に無いアプリ（custom）

`custom.toml` / `custom-desktop.toml` で宣言する。1 アプリ 1 エントリで、導入済み判定（`commands` / `paths`）と
distro ごとの導入方法を書く。

```toml
[[app]]
name = "zed"
commands = ["zed", "zeditor"]

  [app.install.arch]
  package = "zed"

  [app.install.default]
  script = "https://zed.dev/install.sh"
```

導入方法は 3 つ。`install.<distro>` に該当が無ければ `install.default` に落ち、それも無ければその distro
では入れない。

| 方法               | 意味                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `package`          | distro の package manager で入れる。`ppa` を添えると、apt に候補が無いときだけ先に PPA を足す |
| `script`           | 公式インストールスクリプトを `curl \| sh` で流す                                              |
| `tarball` + `dest` | tarball を取得して展開先（既定 `/opt`）に置く                                                 |

これで書けない手順（配布ページの解析やパッチ当てなど）は engine が installer を持つ。その場合は `name`
だけを宣言して `install` を書かない（現在このパターンのアプリは無い）。宣言にも engine にも載らない
アプリは manual-tracked（記録のみ・audit で欠落検知）にする。

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
- 取得は **ghq ツリー**（`<ghq.root>/github.com/<owner>/<repo>`）へ。ghq があれば `ghq get -u`、無ければ
  ghq.root を解決して git で clone/pull する。普通のリポとして編集・pull できる。private repo の取得には
  GitHub 認証が要り、bootstrap が core 適用後に `gh auth login --git-protocol ssh --web` で確立する。
- core でも overlay でも変更があったら `ark update`（core を pull → overlay 取得 → link → install）で
  最新化・再適用する。dotfiles は symlink なので pull で即反映、パッケージは install の再実行で反映される。
- 合成順は core → overlay（配列順）。衝突は後勝ちだが、実態はほぼファイル追加。複雑なマージは避け、git と
  ツールの標準機構に寄せる:

  | 対象                | 仕組み                                                 |
  | ------------------- | ------------------------------------------------------ |
  | `.gitconfig`        | core の値に `includeIf "gitdir:…"` で追加の設定を差す  |
  | `.claude/CLAUDE.md` | 末尾の `@~/.claude/<name>.md`（あれば import）に逃がす |
  | `.zsh.d/*.zsh`      | glob source。overlay はファイルを置くだけ              |

- 使い分けの例: 業務用 `ark-work`（職場 org に置けば同僚と共有可）、個人用 `ark-personal`。
