import { $ } from "@david/dax";
import { log } from "../logger.ts";

/**
 * 既存の crontab にエントリを重複なく追加した内容を返す。
 * コメント行・空行は落とし、同一エントリを含む行は除いてから末尾に追加する。
 */
export function buildCrontabWith(existing: string, entry: string): string {
  const kept = existing
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#") && !line.includes(entry);
    });
  return [...kept, entry].join("\n") + "\n";
}

/**
 * セキュリティスキャンを @reboot で実行する crontab エントリを登録する（重複防止）。
 * command は起動時に単体で成立するコマンド文字列を渡す（cron は PATH が最小なので、
 * mise / deno を絶対パスで解決できる自己完結コマンドにしておくこと）。
 */
export async function registerSecurityScanCron(command: string): Promise<void> {
  const entry = `@reboot ${command}`;
  const existing = await $`crontab -l`.noThrow().text();
  await $`crontab -`.stdinText(buildCrontabWith(existing, entry));
  log.success(`✅ 起動時にセキュリティスキャンを実行するよう登録しました: ${entry}`);
}
