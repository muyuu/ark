import { join } from "@std/path";
import { log } from "../logger.ts";
import { readTextOr } from "../fs.ts";
import { installWinget, parseWingetfile } from "./winget.ts";

/**
 * native Windows のセットアップ。winget で CLI（user スコープ）と GUI（machine スコープ・要管理者）を
 * `app/windows` の宣言リストから導入する。
 *
 * roots は core → overlay の合成順。各 layer の winget_cli / winget_gui を読み合わせて導入する
 * （存在しないものは空として扱う）。winget に無い野良アプリは個別インストーラで別途扱う。
 */
export async function installWindows(roots: string[]): Promise<void> {
  const cli: string[] = [];
  const gui: string[] = [];
  for (const root of roots) {
    const windowsDir = join(root, "app", "windows");
    cli.push(...parseWingetfile(await readTextOr(join(windowsDir, "winget_cli"), "")));
    gui.push(...parseWingetfile(await readTextOr(join(windowsDir, "winget_gui"), "")));
  }

  log.info("🪟 winget で CLI ツールを導入します...");
  await installWinget(cli, "user");

  log.info("🪟 winget で GUI アプリを導入します...");
  await installWinget(gui, "machine");

  log.success("✅ Windows のパッケージ導入が完了しました");
}
