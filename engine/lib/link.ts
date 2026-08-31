import { join, relative } from "@std/path";
import { linkDotfiles, type LinkPlan } from "./dotfiles.ts";
import { layerRoots } from "./overlay.ts";
import { log } from "./logger.ts";

// native Windows で実際に読まれる設定だけに絞る。`/` で終わる項目はその配下すべてを指す。
// zsh は native では無意味、nvim は %LOCALAPPDATA%\nvim を読むのでここには含めない。
const WINDOWS_DOTFILES = [
  ".gitconfig", // %USERPROFILE%\.gitconfig
  ".config/tig", // Git Bash が ~/.config/tig を読む
  ".claude/", // Claude Code (Windows) が %USERPROFILE%\.claude を読む
];

/** $HOME からの相対パス（`/` 区切り）が native Windows で展開する対象か。 */
export function isWindowsDotfile(relativePath: string): boolean {
  return WINDOWS_DOTFILES.some((entry) =>
    entry.endsWith("/") ? relativePath.startsWith(entry) : relativePath === entry
  );
}

function dirExists(path: string): boolean {
  try {
    return Deno.statSync(path).isDirectory;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/**
 * core → overlay の順に各 layer の `config/` を `$HOME` へ symlink で展開する。
 * マージ対象ディレクトリは後の層が同名を上書きする。native Windows では実際に読まれる物だけに絞る。
 */
export async function linkAllLayers(repoRoot: string, homeDir: string): Promise<void> {
  const onlyWindows = (p: LinkPlan) =>
    isWindowsDotfile(relative(homeDir, p.target).replaceAll("\\", "/"));
  const filter = Deno.build.os === "windows" ? onlyWindows : undefined;

  for (const root of await layerRoots(repoRoot, homeDir)) {
    const configDir = join(root, "config");
    if (dirExists(configDir)) await linkDotfiles(configDir, homeDir, log, filter);
  }
}
