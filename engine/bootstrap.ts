import { dirname, fromFileUrl, join } from "@std/path";
import { setupPath } from "./lib/path.ts";
import { linkAllLayers } from "./lib/link.ts";
import { log } from "./lib/logger.ts";

/**
 * 環境設定（PATH と dotfiles）を整える bootstrap の TS 側入口。shell の bootstrap から呼ばれ、
 * .bashrc への Homebrew / mise 活性化追記（Unix のみ）と core → overlay の config 展開を行う。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  if (Deno.build.os !== "windows") {
    await setupPath(home);
  }

  log.info(`🔗 dotfiles を ${home} にリンクします`);
  await linkAllLayers(repoRoot, home);
}
