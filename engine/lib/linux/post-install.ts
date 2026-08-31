import { $ } from "@david/dax";
import { log } from "../logger.ts";
import type { DistroName } from "./distro.ts";

/**
 * docker グループに追加するユーザ名を決める。`USER` を優先し、無ければ `id -un` の結果を使う。
 * どちらも取れなければ undefined（空の名前で usermod を叩くとエラーになるため）。
 *
 * cron / systemd 経由のように `USER` が設定されない環境があるので、フォールバックが要る。
 */
export function dockerGroupUser(envUser: string | undefined, idUn: string): string | undefined {
  return envUser?.trim() || idUn.trim() || undefined;
}

/**
 * ディストリ別のセットアップ後処理。docker が入っていればユーザを docker グループへ追加し、
 * Arch では docker.service を有効化する。変更の適用には再ログインが必要。
 */
export async function runDistroPostInstall(distro: DistroName): Promise<void> {
  if (await $.commandExists("docker")) {
    const user = dockerGroupUser(Deno.env.get("USER"), await $`id -un`.noThrow().text());
    if (user) {
      log.info("🐳 Docker グループにユーザーを追加します");
      await $`sudo usermod -aG docker ${user}`;
      log.success("完了。変更の適用には再ログインが必要です");
    } else {
      log.warning("⚠️ ユーザー名を特定できないため docker グループへの追加をスキップします");
    }
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
