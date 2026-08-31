import { collect, type Layer } from "../layer.ts";
import { log } from "../logger.ts";
import { installWinget, parseWingetfile, upgradeAllWinget } from "./winget.ts";

/**
 * native Windows のセットアップ。まず winget 管理下の全パッケージを最新版へ更新し、続いて CLI
 * （user スコープ）と GUI（machine スコープ・要管理者）を `app/windows` の宣言リストから導入する。
 *
 * 各 layer の winget_cli / winget_gui を合成順に読み合わせて導入する
 * （存在しないものは空として扱う）。winget に無い野良アプリは custom で別途扱う。
 */
export async function installWindows(layers: Layer[]): Promise<void> {
  const cli = await collect(layers, "app/windows/winget_cli", parseWingetfile);
  const gui = await collect(layers, "app/windows/winget_gui", parseWingetfile);

  log.info("🪟 winget 管理下のパッケージを最新化します...");
  await upgradeAllWinget();

  log.info("🪟 winget で CLI ツールを導入します...");
  await installWinget(cli, "user");

  log.info("🪟 winget で GUI アプリを導入します...");
  await installWinget(gui, "machine");

  log.success("✅ Windows のパッケージ導入が完了しました");
}
