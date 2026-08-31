import { $ } from "@david/dax";
import { log } from "../logger.ts";
import { report } from "../report.ts";
import { readTextOr } from "../fs.ts";
import type { PackageManager } from "./distro.ts";
import { installArgs, purgeArgs } from "./package-manager.ts";
import { mapPackageNames } from "./packages.ts";

/** flatpak リストを Flatpak アプリ ID のリストに解釈する。コメント行・行内コメント・空行は無視する。 */
export function parseFlatpakfile(content: string): string[] {
  return content
    .split("\n")
    // `$` は付けない（CRLF の行末 \r でコメント除去が外れるため）
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line.length > 0);
}

// Flatpak 版と同居できない distro パッケージ（論理名）。実パッケージ名は distro map が解決する。
const CONFLICTS: Record<string, string[]> = {
  "com.brave.Browser": ["brave-browser"],
};

/**
 * 宣言された Flatpak アプリと競合する distro パッケージの論理名を返す。
 * 宣言されていないアプリの分は返さない（宣言に無い削除をしないため）。
 */
export function conflictingPackages(appIds: string[]): string[] {
  return appIds.flatMap((id) => CONFLICTS[id] ?? []);
}

/**
 * Flatpak をセットアップして flatpak リストのアプリを導入する。
 * flatpak 未導入なら distro の package manager で入れ、Flathub を追加し、
 * 宣言されたアプリと競合する distro 版だけを削除してから flathub から各アプリを入れる。
 *
 * distroMap は論理パッケージ名を実パッケージ名へ変換する `distro/<name>.map` の内容。
 */
export async function setupFlatpak(
  pm: PackageManager,
  flatpakfilePath: string,
  distroMap: Map<string, string[]>,
): Promise<void> {
  const apps = parseFlatpakfile(await readTextOr(flatpakfilePath, ""));
  if (apps.length === 0) return;

  if (!(await $.commandExists("flatpak"))) {
    log.info("Flatpak をインストールします");
    await $`sudo ${installArgs(pm, ["flatpak"])}`;
  }

  await $`flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo`;

  const conflicts = conflictingPackages(apps)
    .flatMap((name) => mapPackageNames(distroMap, name));
  if (conflicts.length > 0) {
    log.info(`競合する distro 版を削除します: ${conflicts.join(", ")}`);
    await $`sudo ${purgeArgs(pm, conflicts)}`.noThrow();
  }

  for (const app of apps) {
    log.info(`インストール中: ${app}`);
    if ((await $`flatpak install -y flathub ${app}`.noThrow()).code !== 0) {
      log.warning(`⚠️ ${app} を導入できませんでした（スキップ）`);
      report.record("flatpak", app);
    }
  }
  log.success("Flatpak アプリのインストール完了");
}
