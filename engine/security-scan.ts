import { runSecurityScan } from "./lib/linux/security-scan.ts";
import { log } from "./lib/logger.ts";

/** ClamAV / rkhunter でセキュリティスキャンを実行し、結果を ~/.logs/security に保存する。 */
if (import.meta.main) {
  const home = Deno.env.get("HOME");
  if (!home) {
    log.error("HOME が未設定です");
    Deno.exit(1);
  }
  await runSecurityScan(home);
}
