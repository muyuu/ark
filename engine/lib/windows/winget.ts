import { $ } from "@david/dax";
import { log } from "../logger.ts";

/** wingetfile を winget ID のリストに解釈する。1 行 1 ID、`#` 以降と空行は無視する。 */
export function parseWingetfile(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0);
}

/** 指定 ID が winget で導入済みか。winget 管理外（野良）のアプリは検出できない点に注意。 */
async function isInstalled(id: string): Promise<boolean> {
  const result = await $`winget list --id ${id} -e`.noThrow().quiet();
  return result.code === 0;
}

/**
 * winget で各 ID を導入する。導入済みはスキップする。
 * scope に "machine" を渡すと `--scope machine`（要管理者）で入れる（GUI 向け）。
 */
export async function installWinget(ids: string[], scope: "user" | "machine"): Promise<void> {
  for (const id of ids) {
    if (await isInstalled(id)) {
      log.success(`✅ ${id} は導入済みです`);
      continue;
    }
    log.info(`📦 ${id} をインストールしています...`);
    const scopeArgs = scope === "machine" ? ["--scope", "machine"] : [];
    await $`winget install --id ${id} -e --accept-source-agreements --accept-package-agreements ${scopeArgs}`;
  }
}
