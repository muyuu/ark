function contentLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * パッケージリストを論理パッケージ名のリストに解釈する。
 * コメント行・空行は無視し、各行は先頭トークン（行内コメント以降は捨てる）を採用する。
 */
export function parseSystemPackages(content: string): string[] {
  return contentLines(content).map((line) => line.split(/\s+/)[0]);
}

/**
 * distro の .map（`論理名=実名`）を Map に解釈する。コメント行・空行は無視する。
 */
export function parsePackageMap(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of contentLines(content)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

/** 論理名を実パッケージ名に変換する。マップに無ければ論理名をそのまま返す。 */
export function mapPackageName(map: Map<string, string>, logicalName: string): string {
  return map.get(logicalName) ?? logicalName;
}
