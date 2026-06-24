import { join } from "@std/path";
import { $ } from "@david/dax";
import { log } from "../logger.ts";
import { readTextOr } from "../fs.ts";
import { detectDistro, type PackageManager } from "./distro.ts";
import { mapPackageName, parsePackageMap, parseSystemPackages } from "./packages.ts";
import { cleanupCommands, installArgs, updateCommands } from "./package-manager.ts";
import { registerGpgKeys } from "./gpg-keys.ts";
import { setupFlatpak } from "./flatpak.ts";
import { runDistroPostInstall } from "./post-install.ts";
import { isWsl } from "./wsl.ts";

function existsSync(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/** distro PM 用のパッケージ manifest（packages / gui）を論理名→実名に変換して導入する。 */
async function installManifest(
  linuxDir: string,
  distroName: string,
  pm: PackageManager,
  manifest: string,
): Promise<void> {
  const content = await readTextOr(join(linuxDir, manifest), "");
  if (!content) return;

  const map = parsePackageMap(await readTextOr(join(linuxDir, "distro", `${distroName}.map`), ""));
  const packages = parseSystemPackages(content).map((name) => mapPackageName(map, name));
  if (packages.length === 0) return;

  log.info(`${manifest} をインストールします...`);
  await $`sudo ${installArgs(pm, packages)}`;
}

async function runAll(commands: string[][]): Promise<void> {
  for (const argv of commands) {
    await $`sudo ${argv}`;
  }
}

/**
 * Linux 固有のシステム層をセットアップする。distro の package manager で system パッケージを、
 * GUI 環境では GUI パッケージと Flatpak を導入し、キー登録・後処理も行う。
 *
 * Homebrew / CLI ツール（Brewfile）は OS によらず installBrew が所有するためここでは扱わない。
 *
 * GUI 層（gui パッケージ / Flatpak）は GUI を持つ環境にだけ入れる。WSL は headless（GUI はホスト
 * Windows 側）なので GUI 層をスキップする。
 */
export async function installLinuxSystem(repoRoot: string): Promise<void> {
  const linuxDir = join(repoRoot, "app", "linux");

  const gui = !isWsl();
  if (!gui) log.info("WSL を検出: GUI 層はスキップします");

  const distro = detectDistro(existsSync);
  if (!distro) {
    log.error("未対応のディストリビューションです");
    Deno.exit(1);
  }
  log.info(`${distro.name} 系を検出しました`);

  await runAll(updateCommands(distro.packageManager));

  if (distro.name === "debian") {
    await registerGpgKeys(join(linuxDir, "distro", "gpg-keys.txt"));
  }

  await installManifest(linuxDir, distro.name, distro.packageManager, "packages");

  if (gui) {
    await installManifest(linuxDir, distro.name, distro.packageManager, "gui");
    await setupFlatpak(distro.packageManager, join(linuxDir, "flatpak"));
  }

  log.info("クリーンアップします...");
  await runAll(cleanupCommands(distro.packageManager));

  await runDistroPostInstall(distro.name);
  log.success("🎉 Linux システム層のセットアップが完了しました！");
}
