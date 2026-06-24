import { dirname, fromFileUrl, join } from "@std/path";
import { linkDotfiles } from "./lib/dotfiles.ts";
import { layerRoots } from "./lib/overlay.ts";
import { log } from "./lib/logger.ts";

function dirExists(path: string): boolean {
  try {
    return Deno.statSync(path).isDirectory;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME");
  if (!home) {
    log.error("HOME が未設定です");
    Deno.exit(1);
  }

  // core → overlay の順にリンクする（後の層が同名のマージ対象ファイルを上書きする）。
  for (const root of await layerRoots(repoRoot, home)) {
    const configDir = join(root, "config");
    if (!dirExists(configDir)) continue;
    log.info(`🔗 ${configDir} を ${home} にリンクします`);
    await linkDotfiles(configDir, home);
  }
}
