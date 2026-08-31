import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { installBrew } from "./lib/brew.ts";
import { buildCommands } from "./lib/command.ts";
import { runCustomInstallers } from "./lib/custom.ts";
import { isDesktop, isDev, isServer } from "./lib/desktop.ts";
import { installLinuxSystem } from "./lib/linux/install.ts";
import { installWindows } from "./lib/windows/install.ts";
import { layers } from "./lib/layer.ts";
import { warnRenamedManifests } from "./lib/legacy-manifest.ts";
import { setupZsh } from "./lib/zsh.ts";
import { log } from "./lib/logger.ts";
import { report } from "./lib/report.ts";

/**
 * 宣言（app/）を適用してパッケージを導入する。core と取得済み overlay を合成順に処理し、OS で導入経路を
 * 振り分ける: Windows は winget、それ以外は Homebrew（+ Linux は distro のシステム層）と自前コマンド・zsh 設定。
 *
 * 最小層（`packages` / `custom.toml`）はどこでも適用し、そのうえで用途別の層を重ねる:
 * サーバ層（`server`）は表示先の無い Linux に、開発層（`dev` / `custom-dev.toml`）はデスクトップと
 * WSL に、デスクトップ層（`desktop` / `flatpak` / `custom-desktop.toml`）はデスクトップにだけ適用する。
 * サーバ層と開発層は排他。
 *
 * 1 つの導入に失敗しても他は進める。何が入らなかったかは最後にまとめて出す。`--strict` を渡すと
 * 失敗があったときに 0 以外で終了する（オーケストレーションから呼ぶとき用）。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }
  const found = await layers(repoRoot, home);
  warnRenamedManifests(found);
  const desktop = isDesktop();
  const dev = isDev();
  const server = isServer();

  log.info("🔧 mise のツールをインストールしています...");
  await $`mise install`;

  if (Deno.build.os === "windows") {
    await installWindows(found);
  } else {
    await installBrew(found);
    if (Deno.build.os === "linux") await installLinuxSystem(found, { desktop, dev, server });

    const os = Deno.build.os === "darwin" ? "macos" : "linux";
    await runCustomInstallers(found, os, "custom.toml");
    if (server) await runCustomInstallers(found, os, "custom-server.toml");
    if (dev) await runCustomInstallers(found, os, "custom-dev.toml");
    if (desktop) await runCustomInstallers(found, os, "custom-desktop.toml");

    await buildCommands(repoRoot, home);
    await setupZsh(home);
  }

  report.print();
  if (report.hasFailures && Deno.args.includes("--strict")) Deno.exit(1);
}
