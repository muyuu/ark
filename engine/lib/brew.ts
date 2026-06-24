import { join } from "@std/path";
import { $ } from "@david/dax";
import { log } from "./logger.ts";

/**
 * trusted_taps ファイルの内容を tap 名のリストに解釈する。
 * 行内の `#` 以降はコメント、前後の空白は除去し、空行は無視する。
 */
export function parseTrustedTaps(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * インストール対象の Brewfile を OS から選ぶ。repoRoot からの相対で組み立てる。
 *
 * - common (app/common/Brewfile): macOS / Linux 共通
 * - macos (app/macos/Brewfile): macOS のみ
 */
export function selectBrewfiles(os: string, repoRoot: string): string[] {
  const files: string[] = [];

  if (os === "darwin" || os === "linux") {
    files.push(join(repoRoot, "app", "common", "Brewfile"));
  }
  if (os === "darwin") files.push(join(repoRoot, "app", "macos", "Brewfile"));

  return files;
}

function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/**
 * Homebrew のパッケージを導入する。brew 未導入なら何もしない。
 *
 * 更新 → サードパーティ tap の trust → 対象 Brewfile の bundle、の順に実行する。
 * tap の trust は bundle より前に行う（新しい Homebrew は untrusted な tap を無視し bundle が中断するため）。
 * tap（cask 用）は macOS でのみ trust する。
 */
export async function installBrew(repoRoot: string): Promise<void> {
  if (!(await $.commandExists("brew"))) {
    log.warning("⚠️ Homebrew がインストールされていません");
    return;
  }

  log.info("🍺 Homebrew を更新しています...");
  await $`brew update`;
  await $`brew upgrade -f`;

  if (Deno.build.os === "darwin") {
    const tapsFile = join(repoRoot, "app", "macos", "trusted_taps");
    if (fileExists(tapsFile)) {
      log.info("🔑 サードパーティ tap を信頼しています...");
      for (const tap of parseTrustedTaps(await Deno.readTextFile(tapsFile))) {
        await $`brew tap ${tap}`.quiet().noThrow();
        await $`brew trust ${tap}`;
      }
    }
  }

  for (const file of selectBrewfiles(Deno.build.os, repoRoot)) {
    log.info(`📦 ${file} を bundle しています...`);
    await $`brew bundle --file=${file} --no-upgrade`;
  }

  log.success("✅ Homebrew アプリケーションのインストールが完了しました");
}
