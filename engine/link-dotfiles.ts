import { dirname, fromFileUrl, join } from "@std/path";
import { linkDotfiles } from "./lib/dotfiles.ts";
import { log } from "./lib/logger.ts";

if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");
  const configDir = join(repoRoot, "config");

  const home = Deno.env.get("HOME");
  if (!home) {
    log.error("HOME が未設定です");
    Deno.exit(1);
  }

  log.info(`🔗 config を ${configDir} から ${home} にリンクします`);
  await linkDotfiles(configDir, home);
}
