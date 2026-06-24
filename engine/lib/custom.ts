import { join } from "@std/path";
import { readTextOr } from "./fs.ts";
import { log } from "./logger.ts";
import { installReaper } from "./linux/reaper.ts";
import { installDrumGizmo } from "./macos/drumgizmo.ts";

// 野良アプリ（package manager に無い物）の個別インストーラ。名前 → 実装で引く。
// 実装は core engine が持ち（公開しても問題ない）、各 layer が app/<os>/custom で名前を宣言して opt-in する。
const INSTALLERS: Record<string, () => Promise<void>> = {
  reaper: installReaper, // Linux（macOS は brew cask）
  drumgizmo: installDrumGizmo, // macOS（Linux は distro パッケージ）
};

/** custom マニフェスト（1 行 1 名、`#` 以降と空行は無視）を installer 名のリストに解釈する。 */
export function parseCustomList(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * 各 layer の `app/<os>/custom` に宣言された custom installer を合成順に実行する。
 * 未知の名前は警告してスキップする。各 installer は冪等（導入済みなら何もしない）。
 */
export async function runCustomInstallers(roots: string[], os: string): Promise<void> {
  for (const root of roots) {
    const names = parseCustomList(await readTextOr(join(root, "app", os, "custom"), ""));
    for (const name of names) {
      const installer = INSTALLERS[name];
      if (!installer) {
        log.warning(`⚠️ 未知の custom installer: ${name}`);
        continue;
      }
      log.info(`🔧 custom: ${name} を導入します...`);
      await installer();
    }
  }
}
