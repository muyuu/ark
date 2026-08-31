import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { collectKeyDecls } from "./lib/ssh-decls.ts";
import { ensureHostBlock, ensureKey, resolveKeys } from "./lib/ssh.ts";
import { log } from "./lib/logger.ts";

/**
 * 宣言された鍵をこのマシンに揃える（生成と ssh config への固定まで）。GitHub への登録は
 * 登録先アカウントの選択を伴うので別のコマンド（`ark github`）に分けてある。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  const decls = await collectKeyDecls(repoRoot, home);
  const email = (await $`git config --global user.email`.noThrow().text()).trim() ||
    "ark@localhost";

  for (const key of resolveKeys(home, decls)) {
    await ensureKey(key, email);
    await ensureHostBlock(home, key);
  }
}
