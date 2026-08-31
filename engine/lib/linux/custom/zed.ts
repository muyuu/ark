import { $ } from "@david/dax";
import { log } from "../../logger.ts";
import { detectDistro, type DistroName } from "../distro.ts";
import { isNativeCommand } from "../wsl.ts";

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
 * Linux ネイティブの Zed が入っているか。Arch 版は zfs の zed と衝突を避けて zeditor 名になる。
 *
 * WSL は interop で Windows 版 Zed も PATH に載せるため、パスを見て Linux 側の導入だけを数える。
 */
async function hasNativeZed(): Promise<boolean> {
  for (const name of ["zed", "zeditor"]) {
    const path = (await $`command -v ${name}`.noThrow().text()).trim();
    if (isNativeCommand(path)) return true;
  }
  return false;
}

/**
 * Zed エディタをネイティブ導入する。導入済みなら何もしない。
 *
 * IDE はホストのツールチェイン・統合ターミナル連携が必須なため flatpak のサンドボックスは避ける。
 * Arch は pacman、それ以外は公式 install スクリプト（~/.local 配下・自己更新）で入れる。
 */
export async function installZed(): Promise<void> {
  if (Deno.build.os !== "linux") {
    log.warning("Zed の custom 導入は Linux 専用です");
    return;
  }

  if (await hasNativeZed()) {
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
