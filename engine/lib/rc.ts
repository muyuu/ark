import { join } from "@std/path";

/**
 * rc ファイル（.bashrc 等）に marker 付きブロックを冪等に追記する。
 * 既に marker を含む場合は何もしない。追記したら true、既存なら false を返す。
 *
 * block は追記する全文（前後の空行・マーカー行を含む）をそのまま渡す。
 */
export async function ensureRcBlock(
  rcPath: string,
  marker: string,
  block: string,
): Promise<boolean> {
  let existing = "";
  try {
    existing = await Deno.readTextFile(rcPath);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }

  if (existing.includes(marker)) return false;

  await Deno.writeTextFile(rcPath, existing + block);
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
