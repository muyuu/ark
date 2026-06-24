import { setupGithubSsh } from "./lib/github.ts";
import { log } from "./lib/logger.ts";

/** GitHub 用の SSH 鍵を生成・登録する（非対話）。gh の認証自体は事前に済ませておく。 */
if (import.meta.main) {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  await setupGithubSsh(home);
}
