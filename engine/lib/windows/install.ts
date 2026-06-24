import { join } from "@std/path";
import { log } from "../logger.ts";
import { readTextOr } from "../fs.ts";
import { installWinget, parseWingetfile } from "./winget.ts";

/**
 * native Windows のセットアップ。winget で CLI（user スコープ）と GUI（machine スコープ・要管理者）を
 * `app/windows` の宣言リストから導入する。
 *
 * winget に無い野良アプリは個別インストーラ（engine/lib/windows/<app>.ts）で別途扱う。
 */
export async function installWindows(repoRoot: string): Promise<void> {
  const windowsDir = join(repoRoot, "app", "windows");

  const cli = parseWingetfile(await readTextOr(join(windowsDir, "winget_cli"), ""));
  const gui = parseWingetfile(await readTextOr(join(windowsDir, "winget_gui"), ""));

  log.info("🪟 winget で CLI ツールを導入します...");
  await installWinget(cli, "user");

  log.info("🪟 winget で GUI アプリを導入します...");
  await installWinget(gui, "machine");

  log.success("✅ Windows のパッケージ導入が完了しました");
}
