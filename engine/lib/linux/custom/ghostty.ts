import { $ } from "@david/dax";
import { log } from "../../logger.ts";
import { detectDistro, type DistroName } from "../distro.ts";
import { installArgs } from "../package-manager.ts";

export type GhosttyInstallMethod = "pacman" | "dnf" | "apt" | "apt-ppa";

// Ghostty は Ubuntu 26.04 以降の公式リポジトリにしか無い。それ未満向けのコミュニティ PPA。
const PPA = "ppa:mkasberg/ghostty-ubuntu";

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
 * Ghostty の導入経路を決める。Arch (extra) / Fedora は公式パッケージがあるのでそのまま PM に任せる。
 * Debian 系は distro が古いと公式リポジトリに無いため、apt が候補を出せるかで分ける
 * （aptHasCandidate=false のときだけコミュニティ PPA を足す）。distro 判定不能時は Debian 系として扱う。
 */
export function ghosttyInstallMethod(
  distro: DistroName | undefined,
  aptHasCandidate: boolean,
): GhosttyInstallMethod {
  if (distro === "arch") return "pacman";
  if (distro === "fedora") return "dnf";
  return aptHasCandidate ? "apt" : "apt-ppa";
}

/** apt が ghostty のインストール候補を持っているか（公式リポジトリ・登録済み PPA のいずれでも真）。 */
async function aptHasGhostty(): Promise<boolean> {
  const policy = await $`apt-cache policy ghostty`.noThrow().text();
  const candidate = policy.match(/Candidate:\s*(\S+)/)?.[1];
  return candidate !== undefined && candidate !== "(none)";
}

/**
 * Ghostty をネイティブ導入する。導入済みなら何もしない。
 *
 * 公式リポジトリにあるならそれを使い、無い Debian 系（Ubuntu 26.04 未満のベース）でだけ
 * コミュニティ PPA を足す。distro が上がって公式に入れば、PPA を足さない経路へ自動的に戻る。
 */
export async function installGhostty(): Promise<void> {
  if (Deno.build.os !== "linux") {
    log.warning("Ghostty の custom 導入は Linux 専用です");
    return;
  }

  if (await $.commandExists("ghostty")) {
    log.success("Ghostty は既にインストールされています");
    return;
  }

  const distro = detectDistro(existsSync);
  const pm = distro?.packageManager ?? "apt";
  const method = ghosttyInstallMethod(distro?.name, pm === "apt" ? await aptHasGhostty() : false);

  log.info("Ghostty をインストールします...");
  if (method === "apt-ppa") {
    log.info(`公式リポジトリに無いため PPA を追加します: ${PPA}`);
    await $`sudo add-apt-repository -y ${PPA}`;
    await $`sudo apt update`;
  }
  await $`sudo ${installArgs(pm, ["ghostty"])}`;
  log.success("Ghostty を導入しました");
}
