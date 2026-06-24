import { dirname, fromFileUrl, join } from "@std/path";
import { registerSecurityScanCron } from "./lib/linux/cron.ts";

/** セキュリティスキャンを @reboot で実行するよう crontab に登録する。 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");
  // cron は PATH が最小なので mise を絶対パスで解決し、deno 経由で TS を直接実行する。
  const scan = join(repoRoot, "engine/security-scan.ts");
  const command = `$HOME/.local/bin/mise exec deno -- deno run -A ${scan}`;
  await registerSecurityScanCron(command);
}
