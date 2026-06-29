import { $ } from "@david/dax";
import { log } from "../logger.ts";

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

async function wingetInstall(id: string, scope: "machine" | "user"): Promise<boolean> {
  const result =
    await $`winget install --id ${id} -e --accept-source-agreements --accept-package-agreements --scope ${scope}`
      .noThrow();
  return result.code === 0;
}

/**
 * winget で各 ID を導入する。導入済みはスキップする。
 * - scope="user": user スコープ固定（CLI 向け）。
 * - scope="machine": machine（全ユーザー）優先で入れ、machine 非対応（Spotify 等）や非管理者時は
 *   user にフォールバックする（GUI 向け）。アプリ設定はスコープに関係なくユーザーごとに効く。
 */
export async function installWinget(ids: string[], scope: "user" | "machine"): Promise<void> {
  for (const id of ids) {
    if (await isInstalled(id)) {
      log.success(`✅ ${id} は導入済みです`);
      continue;
    }
    log.info(`📦 ${id} をインストールしています...`);
    const ok = scope === "machine"
      ? (await wingetInstall(id, "machine") || await wingetInstall(id, "user"))
      : await wingetInstall(id, "user");
    if (!ok) log.warning(`⚠️ ${id} の導入に失敗しました（スキップ）`);
  }
}
