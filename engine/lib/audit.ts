/** Brewfile から宣言済みの formula / cask 名を取り出す。tap・mas・コメントは無視する。 */
export function parseBrewfileEntries(content: string): { formulae: string[]; casks: string[] } {
  const formulae: string[] = [];
  const casks: string[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const brew = line.match(/^brew\s+"([^"]+)"/);
    if (brew) {
      // tap 付き（org/tap/name）の場合は末尾の名前だけを宣言名として扱う
      formulae.push(brew[1].split("/").pop()!);
      continue;
    }
    const cask = line.match(/^cask\s+"([^"]+)"/);
    if (cask) casks.push(cask[1]);
  }

  return { formulae, casks };
}

/** コマンド出力（1 行 1 名）を名前リストに割る。空行は無視する。 */
export function parseLines(output: string): string[] {
  return output.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

/**
 * 実体（installed）にあってマニフェスト（declared）に無いものを返す。
 * 「ark に書き忘れたままインストールしたもの」の検出に使う。declared 順や重複には依存しない。
 */
export function missingFromManifest(installed: string[], declared: string[]): string[] {
  const known = new Set(declared);
  return installed.filter((name) => !known.has(name));
}
