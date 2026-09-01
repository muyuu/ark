import { $ } from "@david/dax";
import { log } from "../logger.ts";
import { InstallReport, report } from "../report.ts";
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
 * 宣言された Flatpak アプリと競合するために削除すべき、実 distro パッケージ名のリスト。
 * `conflictingPackages` の論理名を distro map で実名へ解決したもの（1 論理名が複数に割れることもある）。
 */
export function conflictPurgeList(appIds: string[], distroMap: Map<string, string[]>): string[] {
  return conflictingPackages(appIds).flatMap((name) => mapPackageNames(distroMap, name));
}

/**
 * Flatpak のセットアップに使う外部コマンド実行。テストから副作用を差し替えるために切り出す。
 * `run` は失敗で例外（セットアップ工程）、`tryRun` は exit code を返す（個別アプリの導入）。
 */
export interface FlatpakShell {
  hasFlatpak: () => Promise<boolean>;
  run: (argv: string[]) => Promise<void>;
  tryRun: (argv: string[]) => Promise<number>;
}

const systemShell: FlatpakShell = {
  hasFlatpak: () => $.commandExists("flatpak"),
  run: async (argv) => {
    await $`${argv}`;
  },
  tryRun: async (argv) => (await $`${argv}`.noThrow()).code,
};

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
  shell: FlatpakShell = systemShell,
  rep: InstallReport = report,
): Promise<void> {
  const apps = parseFlatpakfile(await readTextOr(flatpakfilePath, ""));
  if (apps.length === 0) return;

  if (!(await shell.hasFlatpak())) {
    log.info("Flatpak をインストールします");
    await shell.run(["sudo", ...installArgs(pm, ["flatpak"])]);
  }

  await shell.run([
    "flatpak",
    "remote-add",
    "--if-not-exists",
    "flathub",
    "https://flathub.org/repo/flathub.flatpakrepo",
  ]);

  const conflicts = conflictPurgeList(apps, distroMap);
  if (conflicts.length > 0) {
    log.info(`競合する distro 版を削除します: ${conflicts.join(", ")}`);
    await shell.tryRun(["sudo", ...purgeArgs(pm, conflicts)]);
  }

  for (const app of apps) {
    log.info(`インストール中: ${app}`);
    if ((await shell.tryRun(["flatpak", "install", "-y", "flathub", app])) !== 0) {
      log.warning(`⚠️ ${app} を導入できませんでした（スキップ）`);
      rep.record("flatpak", app);
    }
  }
  log.success("Flatpak アプリのインストール完了");
}
