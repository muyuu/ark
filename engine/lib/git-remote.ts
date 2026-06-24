import { $ } from "@david/dax";
import { log } from "./logger.ts";

export type RemoteConversion =
  | { status: "converted"; url: string }
  | { status: "already-ssh" }
  | { status: "unsupported" };

/**
 * GitHub のリモート URL を SSH 形式へ変換する判定を返す。
 * HTTPS の github.com URL のみ変換対象。既に SSH ならそのまま、それ以外は非対応。
 */
export function githubHttpsToSsh(remoteUrl: string): RemoteConversion {
  const https = remoteUrl.match(/^https:\/\/github\.com\/(.+)$/);
  if (https) {
    const path = https[1].replace(/\.git$/, "").replace(/\/$/, "");
    return { status: "converted", url: `git@github.com:${path}.git` };
  }

  if (remoteUrl.startsWith("git@github.com:")) return { status: "already-ssh" };

  return { status: "unsupported" };
}

/**
 * cwd の git リポジトリの origin を HTTPS から SSH に切り替える。
 * 既に SSH・非対応 URL・git リポジトリでない場合は変更しない。
 */
export async function repoToSsh(cwd: string = Deno.cwd()): Promise<void> {
  const remoteUrl = (await $`git remote get-url origin`.cwd(cwd).noThrow().text()).trim();
  if (!remoteUrl) {
    log.error("origin のリモート URL が取得できません（git リポジトリではない可能性）");
    return;
  }

  const result = githubHttpsToSsh(remoteUrl);
  switch (result.status) {
    case "converted":
      await $`git remote set-url origin ${result.url}`.cwd(cwd);
      log.success(`✅ リモート URL を SSH に更新しました: ${result.url}`);
      break;
    case "already-ssh":
      log.success("✅ すでに SSH URL です。変更は不要です");
      break;
    case "unsupported":
      log.warning(`⚠️ サポートされていない形式のリモート URL: ${remoteUrl}`);
      break;
  }
}
