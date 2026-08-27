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
 * distro の .map（`論理名=実名...`）を Map に解釈する。コメント行・空行は無視する。
 *
 * 右辺は空白区切りで複数書ける。1 つの論理パッケージが distro によって複数パッケージに
 * 分かれる場合（例: Debian の fcitx5-frontend-all = Arch の fcitx5-gtk + fcitx5-qt）に使う。
 */
export function parsePackageMap(content: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of contentLines(content)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const names = line.slice(eq + 1).trim().split(/\s+/).filter((name) => name.length > 0);
    if (names.length === 0) continue;

    map.set(line.slice(0, eq).trim(), names);
  }
  return map;
}

/** 論理名を実パッケージ名に変換する。マップに無ければ論理名そのものを 1 件返す。 */
export function mapPackageNames(map: Map<string, string[]>, logicalName: string): string[] {
  return map.get(logicalName) ?? [logicalName];
}
