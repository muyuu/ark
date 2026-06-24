import { join } from "@std/path";
import { detectBrewPrefix, ensureRcBlock } from "./rc.ts";
import { log } from "./logger.ts";

function pathExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

const BREW_MARKER = "# >>> Homebrew shellenv <<<";
const MISE_MARKER = "# >>> mise activate <<<";

/**
 * .bashrc に Homebrew と mise の活性化設定を冪等に追記する。
 * bash から zsh へ橋渡しする際のフォールバック経路用。brew の導入先が見つからなければ失敗する。
 */
export async function setupPath(homeDir: string): Promise<void> {
  const bashrc = join(homeDir, ".bashrc");

  const prefix = detectBrewPrefix(homeDir, pathExists);
  if (prefix === undefined) {
    throw new Error("Homebrew のインストール先が見つかりません");
  }

  const brewBlock =
    `\n${BREW_MARKER}\neval "$(${prefix}/bin/brew shellenv)"\n# <<< Homebrew shellenv >>>\n`;
  if (await ensureRcBlock(bashrc, BREW_MARKER, brewBlock)) {
    log.info("🛠 .bashrc に Homebrew パス設定を追加しました");
  }

  const miseBlock = `\n${MISE_MARKER}\neval "$(~/.local/bin/mise activate bash)"\n# <<< MISE >>>\n`;
  if (await ensureRcBlock(bashrc, MISE_MARKER, miseBlock)) {
    log.info("🛠 .bashrc に mise activate を追加しました");
  }
}
