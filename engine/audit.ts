import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { missingFromManifest, parseBrewfileEntries, parseLines } from "./lib/audit.ts";
import { parseFlatpakfile } from "./lib/linux/flatpak.ts";
import { layerRoots } from "./lib/overlay.ts";
import { readTextOr } from "./lib/fs.ts";
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
  const roots = await layerRoots(repoRoot, home);

  let found = false;

  if (await $.commandExists("brew")) {
    const formulae: string[] = [];
    const casks: string[] = [];
    for (const root of roots) {
      for (const file of ["app/common/Brewfile", "app/macos/Brewfile"]) {
        const parsed = parseBrewfileEntries(await readTextOr(join(root, file), ""));
        formulae.push(...parsed.formulae);
        casks.push(...parsed.casks);
      }
    }

    const leaves = parseLines(await $`brew leaves`.noThrow().text());
    const installedCasks = parseLines(await $`brew list --cask`.noThrow().text());

    found = report("brew", missingFromManifest(leaves, formulae)) || found;
    found = report("cask", missingFromManifest(installedCasks, casks)) || found;
  }

  if (Deno.build.os === "linux" && await $.commandExists("flatpak")) {
    const declared: string[] = [];
    for (const root of roots) {
      declared.push(...parseFlatpakfile(await readTextOr(join(root, "app/linux/flatpak"), "")));
    }
    const installed = parseLines(
      await $`flatpak list --app --columns=application`.noThrow().text(),
    );
    found = report("flatpak", missingFromManifest(installed, declared)) || found;
  }

  if (found) {
    log.info("→ 残したい物は app/ のマニフェスト（または overlay）に追記してください。");
  } else {
    log.success("✅ マニフェスト未登録のインストール済みパッケージはありません");
  }
}
