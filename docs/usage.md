# 使い方

コマンドの一覧と、日常の操作。仕組みは [architecture.md](./architecture.md) を参照。

## ark コマンド

`ark` は ark リポジトリで `mise run <task>` を叩く zsh 関数（`config/.zsh.d/ark.zsh`）。どこからでも
使える。リポジトリの場所は `ARK_DIR` で上書きできる。zsh 以外（native Windows 等）ではリポジトリ直下で
`mise run <task>` を直接叩く。

| コマンド                                           | 何をするか                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ark`                                              | タスク一覧                                                                      |
| `ark update`                                       | core/overlay を pull → 鍵 → dotfiles → パッケージまで一括で最新化（普段はこれ） |
| `ark install`                                      | 宣言（`app/`）を適用してパッケージを導入する                                    |
| `ark link-dotfiles`                                | `config/` を `$HOME` へ symlink で展開する                                      |
| `ark audit`                                        | 宣言に無いのに入っているパッケージを棚卸しする（変更はしない）                  |
| `ark overlay [add <repo>]`                         | overlay を登録・取得する                                                        |
| `ark ssh-keys`                                     | 宣言された SSH 鍵をこのマシンに揃える（GitHub 登録はしない）                    |
| `ark github`                                       | github.com 用の既定鍵を用意して GitHub に登録する                               |
| `ark repo-to-ssh`                                  | カレントリポジトリの origin を HTTPS→SSH に切り替える                           |
| `ark security-scan` / `ark register-security-cron` | ClamAV / rkhunter のスキャンと起動時登録（Linux）                               |
| `ark test` / `check` / `fmt` / `lint`              | 開発用（[development.md](./development.md)）                                    |

`LOGLEVEL`（`none`/`error`/`warning`/`info`/`verbose`、既定 `info`）でログ量を変えられる。

## 何かを足したいとき

| 足すもの                        | 置き場所                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| CLI ツール（mac/Linux 共通）    | `app/common/Brewfile`                                                               |
| macOS の GUI アプリ             | `app/macos/Brewfile` の `cask`                                                      |
| Linux のシステム/CLI パッケージ | `app/linux/packages` ＋ 名前が違う distro は `app/linux/distro/<distro>.map`        |
| Linux のデスクトップ向け        | `app/linux/gui`（同上）                                                             |
| Linux の GUI アプリ（Flatpak）  | `app/linux/flatpak`                                                                 |
| Windows のアプリ                | `app/windows/winget_cli`（CLI）/ `winget_gui`（GUI）                                |
| PM に無い野良アプリ             | `app/<os>/custom.toml`（常に）/ `custom-gui.toml`（デスクトップのみ）               |
| dotfile                         | `config/` 配下に置く（`.config` / `.claude` / `.zsh.d` は中身が個別にリンクされる） |
| 自前コマンド                    | `command/<name>/`（`ark install` がビルドして `~/.local/bin` に置く）               |

足したら `ark install`（dotfiles なら `ark link-dotfiles`）で反映する。

## overlay

公開できない設定は private repo を重ねる。詳細は [architecture.md](./architecture.md#overlay任意)。

```sh
ark overlay add muyuu/ark-personal   # 登録 → GitHub 認証 → ghq ツリーへ取得
ark update                           # 取得済み overlay も含めて適用
```

## wt（worktree / sandbox）

`command/wt/` の Rust 製 CLI。`wt help` に全サブコマンドがある。

| コマンド                                | 用途                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| `wt new <branch>` / `wt new pr <番号>`  | worktree を作る（`.devcontainer` があれば隔離箱モード） |
| `wt list` / `wt sweep` / `wt rm <name>` | 一覧 / merged・closed を一括削除 / 個別削除             |
| `wt enter <name>`                       | 箱に入って claude を起動する                            |
| `wt sync <name>`                        | 箱の作業をホストへ read-only で fetch する              |

worktree は `<repo>.worktrees/<name>/` に置かれる。`~/.config/wt/<repo>.symlinks` に列挙したファイル
だけが main から symlink される（secret はコピーしない）。
