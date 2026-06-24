import { join } from "@std/path";
import { ensureRcBlock } from "./rc.ts";
import { log } from "./logger.ts";

const ZSH_MARKER = "# >>> zsh fallback <<<";

/** .bashrc に「zsh があれば exec zsh する」fallback を冪等に追記する（bash → zsh 切替）。 */
export async function setupZsh(homeDir: string): Promise<void> {
  const bashrc = join(homeDir, ".bashrc");

  const block = [
    "",
    ZSH_MARKER,
    "if command -v zsh >/dev/null 2>&1; then",
    '  echo "🔄 switching to zsh..."',
    "  exec zsh",
    "fi",
    "# <<< zsh fallback >>>",
    "",
  ].join("\n");

  if (await ensureRcBlock(bashrc, ZSH_MARKER, block)) {
    log.info("🛠 .bashrc に zsh 起動設定を追加しました");
  }
}
