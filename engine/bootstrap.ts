import { dirname, fromFileUrl, join, relative } from "@std/path";
import { setupPath } from "./lib/path.ts";
import { linkDotfiles, type LinkPlan } from "./lib/dotfiles.ts";
import { log } from "./lib/logger.ts";

// native Windows で実際に読まれる設定だけに絞る（git は %USERPROFILE%\.gitconfig、
// tig は Git Bash が ~/.config/tig を読む）。nvim は Zed 利用で不要、zsh は native では無意味。
const WINDOWS_DOTFILES = new Set([".gitconfig", ".config/tig"]);

/**
 * 環境設定（PATH と dotfiles）を整える bootstrap の TS 側入口。shell の bootstrap から呼ばれ、
 * .bashrc への Homebrew / mise 活性化追記（Unix のみ）と config/ の symlink 展開を行う。
 */
if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  if (Deno.build.os !== "windows") {
    await setupPath(home);
  }

  const onlyWindows = (p: LinkPlan) =>
    WINDOWS_DOTFILES.has(relative(home, p.target).replaceAll("\\", "/"));
  const filter = Deno.build.os === "windows" ? onlyWindows : undefined;

  log.info(`🔗 dotfiles を ${home} にリンクします`);
  await linkDotfiles(join(repoRoot, "config"), home, log, filter);
}
