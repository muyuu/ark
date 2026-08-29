import { setupGithubSsh } from "./lib/github.ts";
import { log } from "./lib/logger.ts";

/**
 * このマシンの github.com 用の鍵を用意し、GitHub に登録する（非対話）。gh の認証自体は
 * 事前に済ませておく。用途別の鍵は登録先アカウントの選択を伴うので、ここでは扱わない。
 */
if (import.meta.main) {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  await setupGithubSsh(home);
}
