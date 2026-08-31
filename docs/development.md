# 開発

ark 自体を直す人向け。何をどこに書くかは [architecture.md](./architecture.md)、なぜそうしたかは
[decisions.md](./decisions.md)。

## 開発環境

`mise install` で toolchain（deno / rust）が揃う。以降は mise タスクで回す。

```sh
ark test    # deno test -A
ark check   # deno check engine/
ark fmt     # deno fmt
ark lint    # deno lint
```

`command/wt` は `cd command/wt && cargo build --release`（`ark install` でも同じものがビルドされ
`~/.local/bin/wt` に置かれる）。

## コードの置き場所

| 層           | 置き場所                         | 性質                                                         |
| ------------ | -------------------------------- | ------------------------------------------------------------ |
| 入口         | `bootstrap.sh` / `bootstrap.ps1` | toolchain を用意して engine に渡すだけ。ロジックを増やさない |
| 実行エントリ | `engine/*.ts`                    | `import.meta.main` で引数と環境変数を読むだけの薄い層        |
| ロジック     | `engine/lib/**`                  | OS 非依存は直下、OS 固有は `linux/` `macos/` `windows/`      |
| layer        | `engine/lib/layer.ts`            | core → overlay の合成順と宣言の読み出しを持つ唯一の場所      |
| 宣言         | `app/` `config/` `command/`      | データ。engine から見ると入力                                |

engine の関数は「文字列を解釈する純関数」と「副作用を起こす関数」を分けてあり、テストは前者に付く
（`*_test.ts` が隣に並ぶ）。パーサや経路判定を足すときは純関数として切り出す。

## テスト

`deno test -A` のみ。実機を書き換える処理（`$` でコマンドを叩く関数）はテストしていないので、
副作用のある変更は実マシンか使い捨てのコンテナ/VM で確かめる。

## 変更するときの注意

- **manifest のパーサに `#.*$` を使わない。** CRLF の `\r` が残ってコメント除去が外れる（`#.*` を使う）。
- **テストのパス期待値も `join()` で組み立てる。** `/` 区切りの文字列リテラルを書くと native Windows
  で落ちる（本体が `join()` を使う以上、期待値も同じ形にする）。
- **すべての処理は冪等に。** 2 回流して同じ結果になること。既存ファイルを壊す前に退避する。
- **Linux の論理パッケージ名を足したら 3 つの distro map を見る。** マップに無い名前はそのまま
  package manager に渡り、存在しなければその distro の導入が丸ごと失敗する。
- **秘匿情報・業務情報は core に置かない。** overlay 側に置く（[decisions.md](./decisions.md)）。

## CI

PR ごとに `.github/workflows/ci.yml` が engine（Linux / Windows）・`command/wt`・bootstrap スクリプトを
チェックする。ローカルで `ark test` などを流し忘れてもここで止まる。GitHub Actions の action は
commit SHA で固定してあり、更新するときは SHA と末尾のバージョンコメントの両方を差し替える。

## リリース

タグもバージョンも無い。`main` が唯一の真実で、各マシンは `ark update` で追従する。

## layer を横断して宣言を読む

宣言は core → overlay の順に重なる。読み出しは `engine/lib/layer.ts` に集約してあるので、
パスを自分で組み立てない。

```ts
const found = await layers(repoRoot, home); // core → overlay の合成順
const ids = await collect(found, "app/windows/winget_cli", parseWingetfile); // 連結
const text = await readManifest(layer, "app/linux/packages"); // 1 layer 分
const paths = await existingManifestPaths(found, "app/common/Brewfile"); // 実在する物のパス
```

`Layer` は `name`（`core` / overlay 名）と `root` を持つ。警告に層の名前を出せるので、overlay 側の
宣言が効いていないことに気づける。
