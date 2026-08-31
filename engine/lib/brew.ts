import { $ } from "@david/dax";
import { collect, existingManifestPaths, type Layer } from "./layer.ts";
import { log } from "./logger.ts";
import { report } from "./report.ts";

/**
 * trusted_taps ファイルの内容を tap 名のリストに解釈する。
 * 行内の `#` 以降はコメント、前後の空白は除去し、空行は無視する。
 */
export function parseTrustedTaps(content: string): string[] {
  return content
    .split("\n")
    // `$` は付けない（CRLF の行末 \r でコメント除去が外れるため）
    .map((line) => line.replace(/#.*/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * インストール対象の Brewfile を OS から選ぶ（layer ルートからの相対パス）。
 *
 * - common (app/common/Brewfile): macOS / Linux 共通
 * - macos (app/macos/Brewfile): macOS のみ
 */
export function selectBrewfiles(os: string): string[] {
  const files: string[] = [];

  if (os === "darwin" || os === "linux") files.push("app/common/Brewfile");
  if (os === "darwin") files.push("app/macos/Brewfile");

  return files;
}

/**
 * Homebrew のパッケージを導入する。brew 未導入なら何もしない。
 *
 * 更新 → サードパーティ tap の trust → 対象 Brewfile の bundle、の順に実行する。
 * tap の trust は bundle より前に行う（新しい Homebrew は untrusted な tap を無視し bundle が中断するため）。
 * tap（cask 用）は macOS でのみ trust する。
 *
 * 1 つ入らなくても止めず、入らなかったものは report に残す。
 */
export async function installBrew(layers: Layer[]): Promise<void> {
  if (!(await $.commandExists("brew"))) {
    log.warning("⚠️ Homebrew がインストールされていません");
    return;
  }

  log.info("🍺 Homebrew を更新しています...");
  // 更新に失敗しても bundle は試す価値がある（既存の formula が壊れているだけのことがある）。
  for (const step of [$`brew update`, $`brew upgrade -f`]) {
    if ((await step.noThrow()).code !== 0) report.record("brew", "update");
  }

  if (Deno.build.os === "darwin") {
    const taps = await collect(layers, "app/macos/trusted_taps", parseTrustedTaps);
    if (taps.length > 0) log.info("🔑 サードパーティ tap を信頼しています...");
    for (const tap of taps) {
      await $`brew tap ${tap}`.quiet().noThrow();
      await $`brew trust ${tap}`;
    }
  }

  for (const relPath of selectBrewfiles(Deno.build.os)) {
    for (const file of await existingManifestPaths(layers, relPath)) {
      log.info(`📦 ${file} を bundle しています...`);
      // brew bundle は 1 件ずつ試すので、落ちるのは「入らなかった物がある」の意味。
      if ((await $`brew bundle --file=${file} --no-upgrade`.noThrow()).code !== 0) {
        log.warning(`⚠️ ${file} に入らなかったものがあります`);
        report.record("brew", file);
      }
    }
  }

  log.success("✅ Homebrew アプリケーションのインストールが完了しました");
}
