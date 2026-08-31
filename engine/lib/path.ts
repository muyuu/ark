import { join } from "@std/path";
import { detectBrewPrefix, ensureRcBlock, rcBlock } from "./rc.ts";
import { log, Logger } from "./logger.ts";

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
 * bash から zsh へ橋渡しする際のフォールバック経路用。
 *
 * **brew が無くても失敗しない。** brew はこの層の必須要素ではなく、入れない構成（Homebrew を
 * 使わないサーバなど）でも dotfiles の展開まで進めるようにする。
 */
export async function setupPath(
  homeDir: string,
  logger: Logger = log,
  brewExists: (brewBin: string) => boolean = pathExists,
): Promise<void> {
  const bashrc = join(homeDir, ".bashrc");

  const prefix = detectBrewPrefix(homeDir, brewExists);
  if (prefix === undefined) {
    logger.info("Homebrew が見つかりません。PATH 設定をスキップします");
  } else {
    const brew = rcBlock("# >>> Homebrew shellenv <<<", "# <<< Homebrew shellenv >>>", [
      `eval "$(${prefix}/bin/brew shellenv)"`,
    ]);
    if (await ensureRcBlock(bashrc, brew)) {
      logger.info("🛠 .bashrc の Homebrew パス設定を更新しました");
    }
  }

  // 終了マーカーが開始マーカーと揃っていないのは導入済みマシンに書かれている文字列に合わせるため。
  const mise = rcBlock("# >>> mise activate <<<", "# <<< MISE >>>", [
    'eval "$(~/.local/bin/mise activate bash)"',
  ]);
  if (await ensureRcBlock(bashrc, mise)) {
    logger.info("🛠 .bashrc の mise activate を更新しました");
  }
}
