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

何を入れるかの違いは「どのマシンか」と「どの環境か（OS・デスクトップかどうか）」に還元できる。前者は
overlay、後者は自動判定でカバーできるため、手動で切り替える profile フラグは持たない。

## 層を分ける軸は「GUI の有無」ではなく「デスクトップとして使うか」

WSLg のおかげで WSL でも GUI アプリは動くので、GUI が動くかどうかは層の境界にならない。実際に効く違いは
**その環境をデスクトップとして使うか、開発環境として使うか**。WSL ではブラウザ・ファイルマネージャ・
ターミナルエミュレータ・IME はホストの Windows 側にあるので要らないが、エディタは要る。

そのため層の名前を GUI ではなくデスクトップにし、GUI を持つが開発に要るもの（Zed）は常時の層に置いた。
判定も「WSL かどうか」だけでなく表示先の有無を見る——ssh 越しの Linux やコンテナも同じ理由で対象外になる。

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

## 箱の作業のホスト可視化は host←box の一方向 fetch

箱（sandbox）は named volume の独立 clone なので、ホストの git（Tower 等）からは見えない。ホストに worktree を
rw bind すれば見えるが、箱内コードが worktree の `.git`（hooks 等）を書き換えられ、次のホスト git 実行時に走る
（container→host のコード実行）ため隔離が崩れる。そこで方向を host←box に固定し、箱を read-only な git remote
（`ext::` + `docker exec … git upload-pack`）として `git fetch` するだけにした（`wt sync`）。起動主体はホストで箱は
pack を渡すのみ、fetch クライアント側でリモートのフックは走らないので、隔離を保ったまま可視化できる。取り込み先は
remote-tracking の `refs/remotes/box-<name>/*` にしてローカルブランチを壊さない。

## SSH 鍵はマシンの資産で、GitHub 登録はその利用者

鍵は「GitHub 用に作るもの」ではなく、マシンが持つ資産。GitHub はその登録先の 1 つにすぎない。生成を登録の
内側に置くと、鍵を GitHub 以外へ向けたいときに登録経路を通ることになり、1 マシンに複数の鍵を持つ選択もできない。
そこで鍵の生成と ssh config への固定（`ssh.ts`）を、GitHub への登録（`github.ts`）から切り離し、後者が前者を
使う向きにした。何本持つか（1 マシン 1 本か用途別に複数か）は宣言で決める。自動で GitHub に登録するのは既定鍵
だけ——用途別の鍵は登録先アカウントの選択を伴い、認証中のアカウントへ黙って登録すると誤った紐付けになるため。

## bootstrap に要る鍵は machine-local、用途別の鍵は overlay

overlay は SSH で引くので、その鍵の宣言を overlay の中に置くことはできない（「core は認証なしで bootstrap
できる」と同じにわとりたまご）。bootstrap に要る鍵は overlay の外——既定か machine-local——で持つ。bootstrap に
要らない用途別の鍵は overlay に宣言できる。マシンの用途はどの overlay を入れたかとほぼ同義なので、業務用の鍵は
業務用 overlay に置くのが重複がない。

## custom アプリは宣言で書き、書けない物だけ engine が持つ

custom installer を engine のコードとして名前で引く形にすると、overlay は宣言だけ足しても
「未知の installer」になり、自前のアプリを持てない（overlay は `app/` と `config/` だけの純コンテンツで、
engine は core にしか無い）。実装のほとんどは「PM で入れる」「公式スクリプトを流す」「tarball を展開する」の
繰り返しでもあった。

そこで導入方法を宣言（`custom.toml`）に移し、engine は 3 つの方法を解釈するだけにした。宣言に載らない
手順（配布ページの解析、パッチ当て等）を持つアプリだけ engine が installer を持ち、宣言側は `name` だけを
書いて参照する。overlay は宣言で書ける範囲を自分で持てる。

## サーバではホストの構成を持たない（keel との線引き）

VPS のホスト構成は [keel](https://github.com/muyuu/keel)（Ansible）が持ち、ark は操作者の環境だけを見る。
両方とも「宣言した状態へ収束させる」道具なので、線を引かないと二重管理になる。

実行モデルが逆なので統合はしない。keel は制御側から SSH 越しに push する agentless で、対象に何も入れない
ことが価値。ark は対象マシン自身で pull し、toolchain を入れることが前提。ark へ寄せると keel の価値が
消え、Ansible へ寄せるとまっさらな mac / Windows に Python を先に入れることになり `curl | bash` の一本道が
壊れる。実際 docker と ssh の扱いも重複ではなく補完（keel は公開鍵をサーバへ配り、ark は秘密鍵をマシン上で
作る）。

サーバでは brew を入れない。CLI ツールを 3 経路（brew / distro PM / mise）持つのは過剰で、サーバに要るのは
「ssh して中を見て git を触る」ための最小限だけだから。開発機（デスクトップと WSL）の CLI は brew のまま
にしてある——distro PM へ寄せると版が古くなり、既に brew で入っているものとの二重管理も生む。

## 層は最小 / 開発 / デスクトップの 3 つ

マシンの違いは「人が作業する場所か、サービスを載せる箱か」と「デスクトップとして使うか」に還元できる。
サーバは前者で外れ、WSL は後者で外れる。判定はどちらも自動——デスクトップは表示先の有無、開発機は
デスクトップまたは WSL。

WSLg のおかげで WSL でも GUI は動くので、GUI が動くかどうかは層の境界にならない。WSL に要らないのは
ブラウザ・ファイルマネージャ・IME であって、エディタは要る。だから Zed は開発層、Ghostty はデスクトップ層。
