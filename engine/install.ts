import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { installBrew } from "./lib/brew.ts";
import { buildCommands } from "./lib/command.ts";
import { runCustomInstallers } from "./lib/custom.ts";
import { isDesktop } from "./lib/desktop.ts";
import { installLinuxSystem } from "./lib/linux/install.ts";
import { installWindows } from "./lib/windows/install.ts";
import { layerRoots } from "./lib/overlay.ts";
import { warnRenamedManifests } from "./lib/legacy-manifest.ts";
import { setupZsh } from "./lib/zsh.ts";
import { log } from "./lib/logger.ts";

/**
 * 宣言（app/）を適用してパッケージを導入する。core と取得済み overlay を合成順に処理し、OS で導入経路を
 * 振り分ける: Windows は winget、それ以外は Homebrew（+ Linux は distro のシステム層）と自前コマンド・zsh 設定。
 *
 * デスクトップ層（`desktop` / `flatpak` / `custom-desktop.toml`）はデスクトップ環境にだけ適用する。WSL や headless は
 * 開発環境なので、CLI/システム層と開発用の `custom` までを入れる。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }
  const roots = await layerRoots(repoRoot, home);
  warnRenamedManifests(roots);
  const desktop = isDesktop();

  log.info("🔧 mise のツールをインストールしています...");
  await $`mise install`;

  if (Deno.build.os === "windows") {
    await installWindows(roots);
  } else {
    await installBrew(roots);
    if (Deno.build.os === "linux") await installLinuxSystem(roots, desktop);

    const os = Deno.build.os === "darwin" ? "macos" : "linux";
    await runCustomInstallers(roots, os, "custom.toml");
    if (desktop) await runCustomInstallers(roots, os, "custom-desktop.toml");

    await buildCommands(repoRoot, home);
    await setupZsh(home);
  }
}
