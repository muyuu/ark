import { $ } from "@david/dax";
import { log } from "../logger.ts";

/**
 * 既存の crontab にエントリを重複なく追加した内容を返す。
 *
 * 既存の行はコメント・空行・設定行（MAILTO 等）も含めてそのまま残す。crontab は ark の
 * 管理外の内容も持つので、書き戻しで削ってよいものは無い。同じエントリが既にある場合だけ
 * 追加を見送る（判定は行全体の一致。コメント中に同じ文字列があっても登録済みとはみなさない）。
 */
export function buildCrontabWith(existing: string, entry: string): string {
  const lines = existing.split("\n");
  // 末尾の改行が生む空要素は落とす（末尾の改行は最後に必ず付け直す）。
  if (lines.at(-1) === "") lines.pop();

  const registered = lines.some((line) => line.trim() === entry);
  return [...lines, ...(registered ? [] : [entry])].join("\n") + "\n";
}

/**
 * crontab の読み書き。`registerSecurityScanCron` の副作用をテストから差し替えるために切り出す。
 * 実体は `crontab -l` / `crontab -`（後者は内容を stdin で渡す）。
 */
export interface CrontabIo {
  /** 現在の crontab 全文。未設定のユーザーでは空文字（`crontab -l` は非 0 で終わるが無視する）。 */
  read: () => Promise<string>;
  /** crontab を丸ごと置き換える。 */
  write: (content: string) => Promise<void>;
}

const systemCrontab: CrontabIo = {
  read: () => $`crontab -l`.noThrow().text(),
  write: async (content) => {
    await $`crontab -`.stdinText(content);
  },
};

/**
 * セキュリティスキャンを @reboot で実行する crontab エントリを登録する（重複防止）。
 * command は起動時に単体で成立するコマンド文字列を渡す（cron は PATH が最小なので、
 * mise / deno を絶対パスで解決できる自己完結コマンドにしておくこと）。
 */
export async function registerSecurityScanCron(
  command: string,
  io: CrontabIo = systemCrontab,
): Promise<void> {
  const entry = `@reboot ${command}`;
  const next = buildCrontabWith(await io.read(), entry);
  await io.write(next);
  log.success(`✅ 起動時にセキュリティスキャンを実行するよう登録しました: ${entry}`);
}
