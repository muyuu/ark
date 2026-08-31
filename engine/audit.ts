import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { missingFromManifest, parseBrewfileEntries, parseLines } from "./lib/audit.ts";
import { parseFlatpakfile } from "./lib/linux/flatpak.ts";
import { collect, layers } from "./lib/layer.ts";
import { log } from "./lib/logger.ts";

// マニフェストに書き忘れたままインストールした物を棚卸しする。core + overlay の宣言を横断し、
// 「実体にあって宣言に無い」物だけを並べる。削除や自動追記はしない（判断材料を出すだけ）。

function report(label: string, extras: string[]): boolean {
  if (extras.length === 0) return false;
  log.warning(`📋 ${label}（未登録）: ${extras.join(", ")}`);
  return true;
}

if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "";
  const found = await layers(repoRoot, home);

  let unregistered = false;

  if (await $.commandExists("brew")) {
    const formulae: string[] = [];
    const casks: string[] = [];
    for (const file of ["app/common/Brewfile", "app/macos/Brewfile"]) {
      const parsed = await collect(found, file, (text) => [parseBrewfileEntries(text)]);
      for (const entry of parsed) {
        formulae.push(...entry.formulae);
        casks.push(...entry.casks);
      }
    }

    const leaves = parseLines(await $`brew leaves`.noThrow().text());
    const installedCasks = parseLines(await $`brew list --cask`.noThrow().text());

    unregistered = report("brew", missingFromManifest(leaves, formulae)) || unregistered;
    unregistered = report("cask", missingFromManifest(installedCasks, casks)) || unregistered;
  }

  if (Deno.build.os === "linux" && await $.commandExists("flatpak")) {
    const declared = await collect(found, "app/linux/flatpak", parseFlatpakfile);
    const installed = parseLines(
      await $`flatpak list --app --columns=application`.noThrow().text(),
    );
    unregistered = report("flatpak", missingFromManifest(installed, declared)) || unregistered;
  }

  if (unregistered) {
    log.info("→ 残したい物は app/ のマニフェスト（または overlay）に追記してください。");
  } else {
    log.success("✅ マニフェスト未登録のインストール済みパッケージはありません");
  }
}
