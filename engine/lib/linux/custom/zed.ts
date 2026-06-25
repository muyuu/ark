import { $ } from "@david/dax";
import { log } from "../../logger.ts";
import { detectDistro, type DistroName } from "../distro.ts";

export type ZedInstallMethod = "pacman" | "script";

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
 * Zed の導入経路を distro から決める。公式 PM パッケージがあるのは Arch (extra) のみで、それ以外
 * （Debian / Fedora・判定不能）は公式 install スクリプトに寄せる。
 */
export function zedInstallMethod(distro: DistroName | undefined): ZedInstallMethod {
  return distro === "arch" ? "pacman" : "script";
}

/**
 * Zed エディタをネイティブ導入する。導入済みなら何もしない。
 *
 * IDE はホストのツールチェイン・統合ターミナル連携が必須なため flatpak のサンドボックスは避ける。
 * Arch は pacman、それ以外は公式 install スクリプト（~/.local 配下・自己更新）で入れる。Arch 版の
 * 実行ファイルは zfs の zed と衝突を避けて zeditor 名になるため、導入判定では zed / zeditor 両方を見る。
 */
export async function installZed(): Promise<void> {
  if (Deno.build.os !== "linux") {
    log.warning("Zed の custom 導入は Linux 専用です");
    return;
  }

  if (await $.commandExists("zed") || await $.commandExists("zeditor")) {
    log.success("Zed は既にインストールされています");
    return;
  }

  log.info("Zed をインストールします...");
  if (zedInstallMethod(detectDistro(existsSync)?.name) === "pacman") {
    await $`sudo pacman -S --needed --noconfirm zed`;
  } else {
    await $`sh -c ${"curl -fsSL https://zed.dev/install.sh | sh"}`;
  }
  log.success("Zed を導入しました");
}
