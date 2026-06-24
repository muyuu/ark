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

/**
 * distro PM コマンドを sudo で実行する。apt は依存に MTA 等が入ると debconf の対話を出すため、
 * DEBIAN_FRONTEND=noninteractive を渡して既定値で進める（dnf/pacman では無害な環境変数）。
 */
function sudoPm(argv: string[]): ReturnType<typeof $> {
  return $`sudo env DEBIAN_FRONTEND=noninteractive ${argv}`;
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
  await sudoPm(installArgs(pm, packages));
}

/** 各 layer の app/linux ディレクトリ（存在するかは各処理側で判定）。 */
function linuxDirs(roots: string[]): string[] {
  return roots.map((root) => join(root, "app", "linux"));
}

async function runAll(commands: string[][]): Promise<void> {
  for (const argv of commands) {
    await sudoPm(argv);
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
export async function installLinuxSystem(roots: string[]): Promise<void> {
  const dirs = linuxDirs(roots);

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
    for (const dir of dirs) await registerGpgKeys(join(dir, "distro", "gpg-keys.txt"));
  }

  for (const dir of dirs) {
    await installManifest(dir, distro.name, distro.packageManager, "packages");
  }

  if (gui) {
    for (const dir of dirs) {
      await installManifest(dir, distro.name, distro.packageManager, "gui");
    }
    for (const dir of dirs) await setupFlatpak(distro.packageManager, join(dir, "flatpak"));
  }

  log.info("クリーンアップします...");
  await runAll(cleanupCommands(distro.packageManager));

  await runDistroPostInstall(distro.name);
  log.success("🎉 Linux システム層のセットアップが完了しました！");
}
