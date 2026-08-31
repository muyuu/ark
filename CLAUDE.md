# CLAUDE.md

ark は個人マシンの構成（パッケージ / dotfiles / 自前コマンド）を宣言として持ち、実行のたびに
宣言へ冪等に収束させるリポジトリ。まず以下を読むこと。重複を避けるため、ここには docs に無いこと
だけを書く。

| 知りたいこと                                              | 読む場所                                     |
| --------------------------------------------------------- | -------------------------------------------- |
| 構成・仕組み（layer 合成 / bootstrap / overlay / SSH 鍵） | [docs/architecture.md](docs/architecture.md) |
| なぜその構成なのか（変更提案の前に必ず読む）              | [docs/decisions.md](docs/decisions.md)       |
| コマンドと、宣言を足すときの置き場所                      | [docs/usage.md](docs/usage.md)               |
| コードの層・テスト・変更時の注意                          | [docs/development.md](docs/development.md)   |

## このリポジトリで作業するときの注意

- **`config/` 配下は実マシンの `$HOME` に symlink されている。** ここを編集すると、開いている
  シェルや Claude Code 自身の設定（`config/.claude/`）に即座に効く。
- **実行前提が「ユーザーの実機を書き換える」コード。** `engine/` の副作用のある関数には
  テストが無いので、変更したら何が実機に起きるかを手で追う。安易に試し実行しない。
- **秘匿情報・業務情報を core に置かない。** それらは overlay（別の private repo）の領分。
- **削除は必ずユーザーに確認する。** 宣言からパッケージを外す、dotfile を消す、issue を閉じる等。
- 変更したら `ark test && ark check && ark lint && ark fmt`（= `deno` タスク）を通す。

## ドキュメントの書き分け

- `architecture.md` は**結論だけ**（今どうなっているか）。選定理由は書かない。
- `decisions.md` に**なぜそうしたか**を書く。構成を変えたら両方を更新する。
- `README.md` は「このリポを初めて見た人」向け。何のリポか・使い方・開発方法だけで、詳細は docs へ逃がす。
