import { $ } from "@david/dax";
import { log } from "../logger.ts";
import type { DistroName } from "./distro.ts";

/**
 * ディストリ別のセットアップ後処理。docker が入っていればユーザを docker グループへ追加し、
 * Arch では docker.service を有効化する。変更の適用には再ログインが必要。
 */
export async function runDistroPostInstall(distro: DistroName): Promise<void> {
  if (await $.commandExists("docker")) {
    log.info("🐳 Docker グループにユーザーを追加します");
    await $`sudo usermod -aG docker ${Deno.env.get("USER") ?? ""}`;
    log.success("完了。変更の適用には再ログインが必要です");
  }

  if (distro === "arch") {
    const units = await $`systemctl list-unit-files`.noThrow().text();
    if (units.includes("docker.service")) {
      log.info("Docker サービスを有効化します");
      await $`sudo systemctl enable docker.service`;
      await $`sudo systemctl start docker.service`;
    }
  }
}
