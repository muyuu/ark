import type { PackageManager } from "./distro.ts";

/** パッケージをインストールするコマンド引数（sudo は付けない）。 */
export function installArgs(pm: PackageManager, packages: string[]): string[] {
  switch (pm) {
    case "apt":
      return ["apt", "install", "-y", ...packages];
    case "pacman":
      return ["pacman", "-S", "--noconfirm", ...packages];
    case "dnf":
      return ["dnf", "install", "-y", ...packages];
  }
}

/** パッケージを削除するコマンド引数（Flatpak への移行時の競合除去用）。 */
export function purgeArgs(pm: PackageManager, packages: string[]): string[] {
  switch (pm) {
    case "apt":
      return ["apt", "purge", "-y", ...packages];
    case "pacman":
      return ["pacman", "-Rns", "--noconfirm", ...packages];
    case "dnf":
      return ["dnf", "remove", "-y", ...packages];
  }
}

/** システム更新のコマンド列。apt は update→upgrade の 2 段になる。 */
export function updateCommands(pm: PackageManager): string[][] {
  switch (pm) {
    case "apt":
      return [["apt", "update"], ["apt", "upgrade", "-y"]];
    case "pacman":
      return [["pacman", "-Syu", "--noconfirm"]];
    case "dnf":
      return [["dnf", "upgrade", "-y"]];
  }
}

/** 不要パッケージ・キャッシュの掃除コマンド列。 */
export function cleanupCommands(pm: PackageManager): string[][] {
  switch (pm) {
    case "apt":
      return [["apt", "autoremove", "-y"], ["apt", "autoclean"]];
    case "pacman":
      return [["pacman", "-Sc", "--noconfirm"]];
    case "dnf":
      return [["dnf", "autoremove", "-y"], ["dnf", "clean", "all"]];
  }
}

/**
 * パッケージをまとめて入れ、失敗したら 1 つずつ入れ直して落ちた物の名前を返す。
 *
 * distro PM は 1 つでも存在しない名前があるとコマンド全体が失敗するので、まとめたままでは
 * 「1 個の書き間違いで全滅」になる。通常時は 1 回の呼び出しで済み、失敗したときだけ切り分けの
 * コストを払う。
 *
 * install は「その名前群の導入に成功したか」を返す関数（sudo の実行は呼び出し側が持つ）。
 */
export async function installEach(
  packages: string[],
  install: (names: string[]) => Promise<boolean>,
): Promise<string[]> {
  if (packages.length === 0) return [];
  if (await install(packages)) return [];
  if (packages.length === 1) return [...packages];

  const failed: string[] = [];
  for (const name of packages) {
    if (!(await install([name]))) failed.push(name);
  }
  return failed;
}
