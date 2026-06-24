import { dirname, fromFileUrl, join } from "@std/path";
import { linkAllLayers } from "./lib/link.ts";
import { log } from "./lib/logger.ts";

if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  log.info(`🔗 dotfiles を ${home} にリンクします`);
  await linkAllLayers(repoRoot, home);
}
