import { syncOverlays } from "./lib/overlay.ts";
import { log } from "./lib/logger.ts";

/** overlays.toml に登録された private overlay を取得（未取得なら clone、取得済みなら pull）する。 */
if (import.meta.main) {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }
  await syncOverlays(home);
}
