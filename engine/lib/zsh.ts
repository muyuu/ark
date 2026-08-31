import { join } from "@std/path";
import { ensureRcBlock, rcBlock } from "./rc.ts";
import { log } from "./logger.ts";

/**
 * bash から zsh へ橋渡しする fallback。
 *
 * 切り替えは**対話シェルに限る**（`case $- in *i*`）。bash は `ssh <command>` / `scp` / `rsync` の
 * ような非対話の起動でも rc を読む経路があり、そこで exec すると相手プロトコルに出力が混ざって
 * 転送が壊れる。
 */
const ZSH_BLOCK = rcBlock("# >>> zsh fallback <<<", "# <<< zsh fallback >>>", [
  "case $- in",
  "  *i*)",
  "    if command -v zsh >/dev/null 2>&1; then",
  '      echo "🔄 switching to zsh..."',
  "      exec zsh",
  "    fi",
  "    ;;",
  "esac",
]);

/** .bashrc の zsh fallback を宣言どおりに保つ（無ければ追記、古ければ差し替え）。 */
export async function setupZsh(homeDir: string): Promise<void> {
  if (await ensureRcBlock(join(homeDir, ".bashrc"), ZSH_BLOCK)) {
    log.info("🛠 .bashrc の zsh 起動設定を更新しました");
  }
}
