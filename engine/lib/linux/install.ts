import { type Layer, manifestPath, readManifest } from "../layer.ts";
import { $ } from "@david/dax";
import { log } from "../logger.ts";

import { detectDistro, type DistroName, type PackageManager } from "./distro.ts";
import { mapPackageNames, parsePackageMap, parseSystemPackages } from "./packages.ts";
import { cleanupCommands, installArgs, installEach, updateCommands } from "./package-manager.ts";
import { report } from "../report.ts";
import { registerGpgKeys } from "./gpg-keys.ts";
import { setupFlatpak } from "./flatpak.ts";
import { runDistroPostInstall } from "./post-install.ts";

function existsSync(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/**
 * distro PM コマンドを sudo で実行する。apt は依存に MTA 等が入ると debconf の対話を出すため、
 * DEBIAN_FRONTEND=noninteractive を渡して既定値で進める（dnf/pacman では無害な環境変数）。
 */
function sudoPm(argv: string[]): ReturnType<typeof $> {
  return $`sudo env DEBIAN_FRONTEND=noninteractive ${argv}`;
}

/** sudoPm を実行し、成功したかを返す（失敗しても例外にしない）。 */
async function sudoPmOk(argv: string[]): Promise<boolean> {
  return (await sudoPm(argv).noThrow()).code === 0;
}

/** その layer の distro マップ（論理名→実パッケージ名）を読む。無ければ空。 */
async function loadDistroMap(
  layer: Layer,
  distroName: DistroName,
): Promise<Map<string, string[]>> {
  return parsePackageMap(await readManifest(layer, `app/linux/distro/${distroName}.map`));
}

/** distro PM 用のパッケージ manifest（packages / server / dev / desktop）を論理名→実名に変換して導入する。 */
async function installManifest(
  layer: Layer,
  distroName: DistroName,
  pm: PackageManager,
  manifest: string,
): Promise<void> {
  const content = await readManifest(layer, `app/linux/${manifest}`);
  if (!content) return;

  const map = await loadDistroMap(layer, distroName);
  const packages = parseSystemPackages(content).flatMap((name) => mapPackageNames(map, name));
  if (packages.length === 0) return;

  log.info(`${manifest} をインストールします...`);
  const failed = await installEach(packages, (names) => sudoPmOk(installArgs(pm, names)));
  for (const name of failed) {
    log.warning(`⚠️ ${name} を導入できませんでした（スキップ）`);
    report.record(pm, name);
  }
}

/** システム更新・掃除のコマンド列。1 つ失敗しても以降と後続の処理は続ける。 */
async function runAll(label: string, commands: string[][]): Promise<void> {
  for (const argv of commands) {
    if (!(await sudoPmOk(argv))) {
      log.warning(`⚠️ ${label} に失敗しました: ${argv.join(" ")}`);
      report.record(label, argv.join(" "));
    }
  }
}

/**
 * Linux 固有のシステム層をセットアップする。distro の package manager で system パッケージを、
 * 用途に応じた層のパッケージと Flatpak を導入し、キー登録・後処理も行う。
 *
 * Homebrew / CLI ツール（Brewfile）は OS によらず installBrew が所有するためここでは扱わない。
 *
 * 最小層（packages）はどこでも入れ、そのうえでサーバ層（server）／開発層（dev）／デスクトップ層
 * （desktop / Flatpak）を用途に応じて重ねる。サーバ層と開発層は排他。判定は呼び出し側が行う。
 */
export async function installLinuxSystem(
  layers: Layer[],
  tiers: { desktop: boolean; dev: boolean; server: boolean },
): Promise<void> {
  if (tiers.server) log.info("サーバを検出: 開発層とデスクトップ層はスキップします");
  else if (!tiers.desktop) log.info("デスクトップ環境ではないため、デスクトップ層はスキップします");

  const distro = detectDistro(existsSync);
  if (!distro) {
    // ここで exit すると自前コマンドのビルドや zsh 設定まで巻き添えになる。記録して戻る。
    log.error("未対応のディストリビューションです。システム層をスキップします");
    report.record("distro", "未対応のディストリビューション");
    return;
  }
  log.info(`${distro.name} 系を検出しました`);

  await runAll("distro update", updateCommands(distro.packageManager));

  if (distro.name === "debian") {
    for (const layer of layers) {
      await registerGpgKeys(manifestPath(layer, "app/linux/distro/gpg-keys.txt"));
    }
  }

  // 最小層 → 用途別の層の順に、それぞれ全 layer を合成順で適用する。
  const manifests = ["packages"];
  if (tiers.server) manifests.push("server");
  if (tiers.dev) manifests.push("dev");
  if (tiers.desktop) manifests.push("desktop");

  for (const manifest of manifests) {
    for (const layer of layers) {
      await installManifest(layer, distro.name, distro.packageManager, manifest);
    }
  }

  if (tiers.desktop) {
    for (const layer of layers) {
      const map = await loadDistroMap(layer, distro.name);
      await setupFlatpak(distro.packageManager, manifestPath(layer, "app/linux/flatpak"), map);
    }
  }

  log.info("クリーンアップします...");
  await runAll("distro cleanup", cleanupCommands(distro.packageManager));

  await runDistroPostInstall(distro.name);
  log.success("🎉 Linux システム層のセットアップが完了しました！");
}
