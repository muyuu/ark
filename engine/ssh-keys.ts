import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { layers } from "./lib/layer.ts";
import { GITHUB_KEY_DECL } from "./lib/github.ts";
import {
  ensureHostBlock,
  ensureKey,
  type KeyDecl,
  keysConfigPath,
  loadKeyDecls,
  mergeKeyDecls,
  resolveKeys,
} from "./lib/ssh.ts";
import { log } from "./lib/logger.ts";

/** overlay が用途別の鍵を宣言するファイル名（overlay ルート直下）。 */
const OVERLAY_KEYS_FILE = "ssh-keys.toml";

/**
 * 宣言を合成順（既定 → machine-local → overlay 登録順）に集める。同名は後勝ちなので、
 * 既定鍵の host や comment は machine-local から上書きできる。
 */
async function collectKeyDecls(repoRoot: string, homeDir: string): Promise<KeyDecl[]> {
  const machine = await loadKeyDecls(keysConfigPath(homeDir));

  // 先頭は core。ssh-keys.toml は overlay だけが持つ（core は既定の 1 本しか持たない）。
  const overlayLayers = (await layers(repoRoot, homeDir)).slice(1);
  const overlays: KeyDecl[][] = [];
  for (const layer of overlayLayers) {
    overlays.push(await loadKeyDecls(join(layer.root, OVERLAY_KEYS_FILE)));
  }

  return mergeKeyDecls([GITHUB_KEY_DECL], machine, ...overlays);
}

/**
 * 宣言された鍵をこのマシンに揃える（生成と ssh config への固定まで）。GitHub への登録は
 * 登録先アカウントの選択を伴うので別のコマンド（`ark github`）に分けてある。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  const decls = await collectKeyDecls(repoRoot, home);
  const email = (await $`git config --global user.email`.noThrow().text()).trim() ||
    "ark@localhost";

  for (const key of resolveKeys(home, decls)) {
    await ensureKey(key, email);
    await ensureHostBlock(home, key);
  }
}
