import { join, relative } from "@std/path";
import { linkDotfiles, type LinkPlan } from "./dotfiles.ts";
import { layerRoots } from "./overlay.ts";
import { log } from "./logger.ts";

// native Windows で実際に読まれる設定だけに絞る（git は %USERPROFILE%\.gitconfig、
// tig は Git Bash が ~/.config/tig を読む）。nvim は Zed 利用で不要、zsh は native では無意味。
const WINDOWS_DOTFILES = new Set([".gitconfig", ".config/tig"]);

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
    WINDOWS_DOTFILES.has(relative(homeDir, p.target).replaceAll("\\", "/"));
  const filter = Deno.build.os === "windows" ? onlyWindows : undefined;

  for (const root of await layerRoots(repoRoot, homeDir)) {
    const configDir = join(root, "config");
    if (dirExists(configDir)) await linkDotfiles(configDir, homeDir, log, filter);
  }
}
