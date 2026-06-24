import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { installBrew } from "./lib/brew.ts";
import { buildCommands } from "./lib/command.ts";
import { installLinuxSystem } from "./lib/linux/install.ts";
import { installWindows } from "./lib/windows/install.ts";
import { setupZsh } from "./lib/zsh.ts";
import { log } from "./lib/logger.ts";

/**
 * core の宣言（app/）を適用してパッケージを導入する。OS で導入経路を振り分ける:
 * Windows は winget、それ以外は Homebrew（+ Linux は distro のシステム層）と zsh 設定。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  log.info("🔧 mise のツールをインストールしています...");
  await $`mise install`;

  if (Deno.build.os === "windows") {
    await installWindows(repoRoot);
  } else {
    const home = Deno.env.get("HOME");
    if (!home) {
      log.error("HOME が未設定です");
      Deno.exit(1);
    }
    await installBrew(repoRoot);
    if (Deno.build.os === "linux") await installLinuxSystem(repoRoot);
    await buildCommands(repoRoot, home);
    await setupZsh(home);
  }
}
