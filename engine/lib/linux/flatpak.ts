import { $ } from "@david/dax";
import { log } from "../logger.ts";
import { readTextOr } from "../fs.ts";
import type { PackageManager } from "./distro.ts";
import { installArgs, purgeArgs } from "./package-manager.ts";

/** flatpak リストを Flatpak アプリ ID のリストに解釈する。コメント行・行内コメント・空行は無視する。 */
export function parseFlatpakfile(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0);
}

// Flatpak 版へ移行する際に競合する distro パッケージ名（package manager ごとに名称が異なる）。
const CONFLICTING_APPS: Record<PackageManager, string[]> = {
  apt: ["brave-browser"],
  pacman: ["brave-bin"],
  dnf: ["brave-browser"],
};

/**
 * Flatpak をセットアップして flatpak リストのアプリを導入する。
 * flatpak 未導入なら distro の package manager で入れ、Flathub を追加し、
 * 競合する distro 版を削除してから flathub から各アプリを入れる。
 */
export async function setupFlatpak(pm: PackageManager, flatpakfilePath: string): Promise<void> {
  if (!(await $.commandExists("flatpak"))) {
    log.info("Flatpak をインストールします");
    await $`sudo ${installArgs(pm, ["flatpak"])}`;
  }

  await $`flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`;

  const apps = parseFlatpakfile(await readTextOr(flatpakfilePath, ""));
  if (apps.length === 0) return;

  log.info("競合する distro 版アプリを削除します");
  await $`sudo ${purgeArgs(pm, CONFLICTING_APPS[pm])}`.noThrow();

  for (const app of apps) {
    log.info(`インストール中: ${app}`);
    await $`flatpak install -y flathub ${app}`.noThrow();
  }
  log.success("Flatpak アプリのインストール完了");
}
