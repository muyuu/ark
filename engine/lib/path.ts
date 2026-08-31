import { join } from "@std/path";
import { detectBrewPrefix, ensureRcBlock, rcBlock } from "./rc.ts";
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

/**
 * .bashrc に Homebrew と mise の活性化設定を冪等に置く。
 * bash から zsh へ橋渡しする際のフォールバック経路用。brew の導入先が見つからなければ失敗する。
 */
export async function setupPath(homeDir: string): Promise<void> {
  const bashrc = join(homeDir, ".bashrc");

  const prefix = detectBrewPrefix(homeDir, pathExists);
  if (prefix === undefined) {
    throw new Error("Homebrew のインストール先が見つかりません");
  }

  const brew = rcBlock("# >>> Homebrew shellenv <<<", "# <<< Homebrew shellenv >>>", [
    `eval "$(${prefix}/bin/brew shellenv)"`,
  ]);
  if (await ensureRcBlock(bashrc, brew)) {
    log.info("🛠 .bashrc の Homebrew パス設定を更新しました");
  }

  // 終了マーカーが開始マーカーと揃っていないのは導入済みマシンに書かれている文字列に合わせるため。
  const mise = rcBlock("# >>> mise activate <<<", "# <<< MISE >>>", [
    'eval "$(~/.local/bin/mise activate bash)"',
  ]);
  if (await ensureRcBlock(bashrc, mise)) {
    log.info("🛠 .bashrc の mise activate を更新しました");
  }
}
