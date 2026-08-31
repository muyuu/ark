import { join } from "@std/path";
import { log } from "./logger.ts";

/** rc ファイル（.bashrc 等）に置く、マーカーで囲んだブロック 1 つ。 */
export interface RcBlock {
  /** 開始マーカー行。既存ブロックの検出に使う。 */
  start: string;
  /** 終了マーカー行。 */
  end: string;
  /** マーカー行を含むブロック本体（前後の空行は含まない）。 */
  body: string;
}

/**
 * マーカーで囲んだ rc ブロックを組み立てる。
 *
 * マーカー文字列は導入済みのマシンに既に書かれているものと一致していなければ既存ブロックを
 * 見つけられないため、名前から導かず明示で受け取る。
 */
export function rcBlock(start: string, end: string, lines: string[]): RcBlock {
  return { start, end, body: [start, ...lines, end].join("\n") };
}

/**
 * rc ファイルのブロックを宣言どおりの内容に保つ。無ければ末尾に追記し、既にあって内容が
 * 変わっていればその区間だけを差し替える。変更したら true、既に一致していれば false を返す。
 *
 * 内容が変わったときに差し替えるのは、導入済みのマシンにも修正を届けるため。マーカーの有無
 * だけを見てスキップすると、一度書かれた古いブロックが永久に残る。
 *
 * 開始マーカーはあるのに終了マーカーが無い（手で壊された）場合は、どこまでがブロックか
 * 判断できないので触らずに警告する。
 */
export async function ensureRcBlock(rcPath: string, block: RcBlock): Promise<boolean> {
  let existing = "";
  try {
    existing = await Deno.readTextFile(rcPath);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }

  const from = existing.indexOf(block.start);
  if (from === -1) {
    await Deno.writeTextFile(rcPath, `${existing}\n${block.body}\n`);
    return true;
  }

  const endAt = existing.indexOf(block.end, from);
  if (endAt === -1) {
    log.warning(`${rcPath}: ${block.start} の終了マーカーが見つかりません（手で直してください）`);
    return false;
  }

  const to = endAt + block.end.length;
  if (existing.slice(from, to) === block.body) return false;

  await Deno.writeTextFile(rcPath, existing.slice(0, from) + block.body + existing.slice(to));
  return true;
}

/**
 * Homebrew のインストール先を候補から推定する。優先順は linuxbrew 系 → /opt/homebrew → /usr/local。
 * 判定は候補ディレクトリの有無ではなく `<prefix>/bin/brew` の実体で行う
 * （/usr/local はほぼ常に存在するため、ディレクトリ有無では誤検出するため）。
 * いずれにも brew が無ければ undefined。
 */
export function detectBrewPrefix(
  homeDir: string,
  brewExists: (brewBin: string) => boolean,
): string | undefined {
  const candidates = [
    "/home/linuxbrew/.linuxbrew",
    join(homeDir, ".linuxbrew"),
    "/opt/homebrew",
    "/usr/local",
  ];
  return candidates.find((prefix) => brewExists(join(prefix, "bin", "brew")));
}
