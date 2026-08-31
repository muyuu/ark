import { join } from "@std/path";
import { layers } from "./layer.ts";
import { GITHUB_KEY_DECL } from "./github.ts";
import { type KeyDecl, keysConfigPath, loadKeyDecls, mergeKeyDecls } from "./ssh.ts";

/** overlay が用途別の鍵を宣言するファイル名（overlay ルート直下）。 */
export const OVERLAY_KEYS_FILE = "ssh-keys.toml";

/**
 * 宣言を合成順（既定 → machine-local → overlay 登録順）に集める。同名は後勝ちなので、
 * 既定鍵の host や comment は machine-local から上書きできる。
 */
export async function collectKeyDecls(repoRoot: string, homeDir: string): Promise<KeyDecl[]> {
  const machine = await loadKeyDecls(keysConfigPath(homeDir));

  // 先頭は core。ssh-keys.toml は overlay だけが持つ。
  const overlayLayers = (await layers(repoRoot, homeDir)).slice(1);
  const overlays: KeyDecl[][] = [];
  for (const layer of overlayLayers) {
    overlays.push(await loadKeyDecls(join(layer.root, OVERLAY_KEYS_FILE)));
  }

  return mergeKeyDecls([GITHUB_KEY_DECL], machine, ...overlays);
}
