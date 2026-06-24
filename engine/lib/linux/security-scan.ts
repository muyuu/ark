import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { $ } from "@david/dax";
import { log } from "../logger.ts";

/** ClamAV のログに感染ファイル（1 件以上）が記録されているか。 */
export function clamavHasInfection(clamLog: string): boolean {
  return /Infected files: [1-9]/.test(clamLog);
}

/** rkhunter のログに警告・疑わしいファイルが記録されているか。 */
export function rkhunterHasWarning(rkhLog: string): boolean {
  return /Warning:|Suspicious file/.test(rkhLog);
}

async function notify(message: string): Promise<void> {
  if (await $.commandExists("notify-send")) {
    await $`notify-send ${"Security Alert"} ${message}`;
  } else {
    log.warning(`⚠️ Security Alert: ${message}`);
  }
}

/**
 * ClamAV と rkhunter でスキャンし、ログを ~/.logs/security に保存する。
 * 異常を検出したら notify-send（無ければ標準エラー）で通知する。
 */
export async function runSecurityScan(homeDir: string): Promise<void> {
  const logDir = join(homeDir, ".logs/security");
  await ensureDir(logDir);
  const clamLog = join(logDir, "clamav.log");
  const rkhLog = join(logDir, "rkhunter.log");

  log.info("ClamAV スキャン開始...");
  await Deno.writeTextFile(clamLog, await $`clamscan -r --bell -i /home`.noThrow().text());

  log.info("rkhunter スキャン開始...");
  await Deno.writeTextFile(rkhLog, await $`rkhunter --check --sk`.noThrow().text());

  if (clamavHasInfection(await Deno.readTextFile(clamLog))) {
    await notify("ClamAV: 感染ファイルが検出されました");
  } else {
    log.success("ClamAV: 異常なし");
  }

  if (rkhunterHasWarning(await Deno.readTextFile(rkhLog))) {
    await notify("rkhunter: 異常が検出されました");
  } else {
    log.success("rkhunter: 異常なし");
  }

  await Deno.writeTextFile(
    join(logDir, "scan-history.log"),
    `${new Date().toISOString()}: スキャン完了\n`,
    { append: true },
  );
}
