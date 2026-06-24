import { addOverlay, nameFromUrl, normalizeRepoUrl, syncOverlays } from "./lib/overlay.ts";
import { ensureGithubSshReady } from "./lib/github.ts";
import { log } from "./lib/logger.ts";

/**
 * overlay を取得する。
 *   （引数なし）           : overlays.toml に登録済みの overlay をすべて取得（clone / pull）。
 *   add <owner/repo | git-url> [name]
 *       : overlay を登録 → GitHub 認証・SSH 鍵を用意 → 取得。owner/repo は GitHub の SSH URL に展開。
 *         name 省略時はリポジトリ名から導く。
 */
if (import.meta.main) {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  const [cmd, ...rest] = Deno.args;

  if (cmd === "add") {
    if (!rest[0]) {
      log.error("使い方: ark overlay add <owner/repo | git-url> [name]");
      Deno.exit(1);
    }
    const url = normalizeRepoUrl(rest[0]);
    const name = rest[1] ?? nameFromUrl(url);
    await ensureGithubSshReady(home);
    if (await addOverlay(home, name, url)) {
      log.success(`✅ overlay を登録しました: ${name} (${url})`);
    } else {
      log.info(`overlay は既に登録済みです: ${name}`);
    }
  }

  await syncOverlays(home);
  log.info("→ 適用するには `ark update` を実行してください。");
}
