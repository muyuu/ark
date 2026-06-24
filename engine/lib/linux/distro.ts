export type DistroName = "debian" | "arch" | "fedora";
export type PackageManager = "apt" | "pacman" | "dnf";

export interface Distro {
  /** distro/<name>.map のベース名にも対応する論理ディストリ名。 */
  name: DistroName;
  packageManager: PackageManager;
}

/**
 * /etc/*-release 系ファイルの有無からディストリビューションを判定する。
 * RHEL 系は fedora マップ + dnf に寄せる。該当なしは undefined。
 */
export function detectDistro(fileExists: (path: string) => boolean): Distro | undefined {
  if (fileExists("/etc/debian_version")) return { name: "debian", packageManager: "apt" };
  if (fileExists("/etc/arch-release")) return { name: "arch", packageManager: "pacman" };
  if (fileExists("/etc/fedora-release")) return { name: "fedora", packageManager: "dnf" };
  if (fileExists("/etc/redhat-release")) return { name: "fedora", packageManager: "dnf" };
  return undefined;
}
