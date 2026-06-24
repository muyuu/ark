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
