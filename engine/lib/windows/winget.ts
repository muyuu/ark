import { $ } from "@david/dax";
import { log } from "../logger.ts";
import { report } from "../report.ts";
import { isElevated } from "./elevation.ts";

/** wingetfile を winget ID のリストに解釈する。1 行 1 ID、`#` 以降と空行は無視する。 */
export function parseWingetfile(content: string): string[] {
  return content
    .split("\n")
    // `$` は付けない: CRLF 改行だと行末の \r が残り `#.*$` がマッチせずコメントを除去できないため。
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line.length > 0);
}

/** winget ID の名前部分（最後のドット以降）。導入済み判定のフォールバック検索語に使う。 */
export function wingetIdName(id: string): string {
  const i = id.lastIndexOf(".");
  return i === -1 ? id : id.slice(i + 1);
}

/**
 * 指定 ID が winget で導入済みか。winget 管理外（野良）のアプリは検出できない点に注意。
 *
 * 終了コードは winget の版によって当てにならないため、出力に検索語が現れるかで判定する。
 * 初回は source の利用規約同意が要るので --accept-source-agreements を付ける。
 *
 * まず `--id -e` の厳密一致で見るが、これは ID と ARP（インストール済み一覧）の対応が取れる
 * パッケージにしか効かない。Dropbox のように manifest が ProductCode / AppsAndFeaturesEntries を
 * 持たず、かつ winget 経由で入れていないアプリは ID 対応が無く厳密一致では永遠に未検出になる
 * （＝毎回再インストールを試みる）。そこで空振り時は名前部分でのフリー検索にフォールバックし、
 * 既存インストールを名前で拾う。名前一致のため別アプリを取り違える可能性は残る。
 */
async function isInstalled(id: string): Promise<boolean> {
  const exact = await $`winget list --id ${id} -e --accept-source-agreements`.noThrow().text();
  if (exact.includes(id)) return true;

  const name = wingetIdName(id);
  const byName = await $`winget list ${name} --accept-source-agreements`.noThrow().text();
  return byName.includes(name);
}

/**
 * `winget upgrade --all` の引数列。
 *
 * バージョン不明のパッケージも対象にするため --include-unknown を付ける。非管理者のときは machine
 * スコープのパッケージ（Git 等）を更新できず、winget が UAC を出しては毎回失敗するので、
 * --disable-interactivity でプロンプトを抑えて素早く空振りさせる。
 */
export function wingetUpgradeArgv(elevated: boolean): string[] {
  const argv = [
    "winget",
    "upgrade",
    "--all",
    "--include-unknown",
    "--accept-source-agreements",
    "--accept-package-agreements",
  ];
  return elevated ? argv : [...argv, "--disable-interactivity"];
}

/** `winget install` の引数列。scope を渡さなければ --scope を付けない。 */
export function wingetInstallArgv(id: string, scope?: "machine" | "user"): string[] {
  const argv = [
    "winget",
    "install",
    "--id",
    id,
    "-e",
    "--accept-source-agreements",
    "--accept-package-agreements",
  ];
  return scope ? [...argv, "--scope", scope] : argv;
}

/**
 * scope 別の winget install 試行順。
 *
 * - user: user スコープ → スコープ指定なし
 * - machine: machine → user → スコープ指定なし
 *
 * どちらも最後にスコープ指定なしを試すのは、manifest の installer が `Scope` を宣言していない
 * （Rustlang.Rustup の rustup-init.exe 等）と、新しめの winget が `--scope` 指定時に
 * 「該当するインストーラーが見つかりません」で弾くため。スコープ無しなら winget の既定で入る。
 */
export function scopeAttempts(scope: "user" | "machine"): Array<"machine" | "user" | undefined> {
  return scope === "machine" ? ["machine", "user", undefined] : ["user", undefined];
}

/** scope の試行順に install を呼び、最初に成功したら true を返す。全滅なら false。 */
export async function installWithFallback(
  scope: "user" | "machine",
  install: (scope?: "machine" | "user") => Promise<boolean>,
): Promise<boolean> {
  for (const attempt of scopeAttempts(scope)) {
    if (await install(attempt)) return true;
  }
  return false;
}

/**
 * winget 管理下の全パッケージを最新版へ更新する。導入済みパッケージのバージョンアップはこれが担う
 * （install はスキップ判定するだけで版を上げないため）。
 *
 * 対象は winget 管理下の全アプリで、ark の宣言リストには限らない（brew upgrade -f と同じ広さ）。
 * 個々の更新失敗で全体を止めないよう noThrow で流す。非管理者では machine スコープ分を更新できない
 * ので、「管理者で再実行」を促して report に記録する（`mise run update` は通常こちらの経路）。
 */
export async function upgradeAllWinget(): Promise<void> {
  const elevated = await isElevated();
  await $`${wingetUpgradeArgv(elevated)}`.noThrow();
  if (!elevated) {
    log.warning(
      "⚠️ machine スコープのパッケージ更新には管理者権限が要ります。更新するには管理者 PowerShell で" +
        "リポジトリ直下から `mise run update` を再実行してください（user スコープ分は更新済み）",
    );
    report.record("winget upgrade", "machine スコープ（非管理者のためスキップ）");
  }
}

async function wingetInstall(id: string, scope?: "machine" | "user"): Promise<boolean> {
  const result = await $`${wingetInstallArgv(id, scope)}`.noThrow();
  return result.code === 0;
}

/**
 * winget で各 ID を導入する。導入済みはスキップする。
 * - scope="user": user スコープ優先（CLI 向け）。
 * - scope="machine": machine（全ユーザー）優先で入れ、machine 非対応（Spotify 等）や非管理者時は
 *   user にフォールバックする（GUI 向け）。アプリ設定はスコープに関係なくユーザーごとに効く。
 *
 * 試行順とスコープ無しフォールバックの理由は scopeAttempts を参照。
 */
export async function installWinget(ids: string[], scope: "user" | "machine"): Promise<void> {
  for (const id of ids) {
    if (await isInstalled(id)) {
      log.success(`✅ ${id} は導入済みです`);
      continue;
    }
    log.info(`📦 ${id} をインストールしています...`);
    const ok = await installWithFallback(scope, (attempt) => wingetInstall(id, attempt));
    if (!ok) {
      log.warning(`⚠️ ${id} の導入に失敗しました（スキップ）`);
      report.record("winget", id);
    }
  }
}
