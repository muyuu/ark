import { join, relative } from "@std/path";
import { linkDotfiles, type LinkPlan, planLinks } from "./dotfiles.ts";
import { layers } from "./layer.ts";
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

function listDirReal(dir: string): string[] {
  return [...Deno.readDirSync(dir)].map((entry) => entry.name);
}

/** native Windows では実際に読まれる物だけに絞る。他の OS では絞らない。 */
function windowsFilter(homeDir: string): ((plan: LinkPlan) => boolean) | undefined {
  if (Deno.build.os !== "windows") return undefined;
  return (plan) => isWindowsDotfile(relative(homeDir, plan.target).replaceAll("\\", "/"));
}

/**
 * 全 layer ぶんの symlink 計画を、実際には張らずに算出する。
 * doctor が「宣言どおりに張られているか」を見るのに使う。
 */
export async function plannedLinks(repoRoot: string, homeDir: string): Promise<LinkPlan[]> {
  const filter = windowsFilter(homeDir) ?? (() => true);
  const plans: LinkPlan[] = [];

  for (const layer of await layers(repoRoot, homeDir)) {
    const configDir = join(layer.root, "config");
    if (dirExists(configDir)) {
      plans.push(...planLinks(configDir, homeDir, listDirReal).filter(filter));
    }
  }
  return plans;
}

/**
 * core → overlay の順に各 layer の `config/` を `$HOME` へ symlink で展開する。
 * マージ対象ディレクトリは後の層が同名を上書きする。native Windows では実際に読まれる物だけに絞る。
 */
export async function linkAllLayers(repoRoot: string, homeDir: string): Promise<void> {
  const filter = windowsFilter(homeDir);

  for (const layer of await layers(repoRoot, homeDir)) {
    const configDir = join(layer.root, "config");
    if (dirExists(configDir)) await linkDotfiles(configDir, homeDir, log, filter);
  }
}
