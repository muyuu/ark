# 設計判断

[architecture.md](./architecture.md) の構成がなぜそうなっているかを残す。構成そのものは architecture.md に置く。

## engine は Deno + TS / 常用コマンドは Rust

実行頻度とレイテンシ感度で言語を選ぶ。engine（install / update / audit）はたまに走るだけでレイテンシが
効かず、型と標準ライブラリの厚い Deno + TS が書きやすい。対話で頻繁に叩くコマンドは起動レイテンシが
効くので、単一バイナリで速い Rust。`command/` 自体は言語非依存の入れ物で、用途に応じて他言語のコマンドも
置ける（コマンドごとに独立した自己完結プロジェクトにし、`command/` を特定言語のプロジェクトルートにはしない）。

## command は build-on-target

bootstrap が mise で rust を用意するので、任意のマシンで `cargo build --release` できる。prebuilt バイナリを
配るより release workflow を持たずに済み、ソースと常に一致する。mac/Linux はリンカが標準で揃う。Windows の
rust(MSVC) はリンカ（VS Build Tools）が別途要るため、Windows でのビルドは既定でスキップし、必要なときだけ
opt-in する。

## 導入対象は OS と環境で決まる（手動の profile を持たない）

何を入れるかの違いは「どのマシンか」と「どの環境か（OS・GUI の有無）」に還元できる。前者は overlay、後者は
自動判定でカバーできるため、手動で切り替える profile フラグは持たない。GUI 向けの宣言は GUI を持つ環境に
だけ適用される。

## マージ対象のディレクトリは中身を個別リンクする

`.zsh.d` / `.config` / `.claude` は core と overlay が同じ `$HOME` 配下のディレクトリへ各自のファイルを足す。
ディレクトリ自体を symlink にすると 1 つの layer しか持てないため、中身を 1 つずつリンクして `$HOME` 側を実
ディレクトリに保つ。これにより `.zshrc` の glob source や `.claude` の読み込みが全 layer のファイルをまとめて
拾える。`.config` / `.claude` には ark 管理外のランタイム状態（cache・session 等）も混ざるので、この方式は
管理外を巻き込まない意味でも必須。

## private な設定は overlay として別 repo に置く

秘匿情報・業務情報（社内リポ名・設計知識など）は public な core に置けない。導入対象を絞る軸（OS・環境）で
「入れない」だけではテキストとして public に残るため、隠すには物理的に別の private repo へ分けるしかない。
業務用と個人用を別の overlay にできるのは、共有範囲とライフサイクルが違うため（業務用は職場 org で同僚と
共有しうる、個人用は個人専用）。

## core は認証なしで bootstrap できる

private repo は `raw.githubusercontent.com` からの未認証取得に 404 を返し、匿名 HTTPS clone も通らない。
「bootstrap に GitHub 認証が要る／その認証手段を得るのに bootstrap が要る」というにわとりたまごを避けるため、
core は public にして認証なしで取得・適用できるようにする。private overlay を引くときだけ認証が要り、それは
core が確立する。これが成り立つよう core には秘匿・業務情報を置かない。

## overlay 登録は machine-local な TOML

どの overlay を使うかはマシンごとに違う。マシン固有の選択は repo に入れず machine-local に置く。形式は
TOML——`@std/toml` でパースでき、素の行より構造を素直に表せる。

## 個人メールは core の gitconfig に置く

個人メールは git のコミット履歴で実質公開済みで、gitconfig の公開は一般的。業務メールだけは core に置かず、
overlay の `includeIf` で業務リポ配下にスコープして差す。

## secret は repo に入れない

秘匿ファイルが必要な場合は、実体を repo の外で管理し symlink で渡す。repo には実体を置かない。
