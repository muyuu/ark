import { $ } from "@david/dax";

/** PowerShell の IsInRole 判定結果（"True" / "False" 行）を真偽に読む。前後の空白・大小は無視。 */
export function parseIsElevated(output: string): boolean {
  return output.trim().toLowerCase() === "true";
}

/**
 * 現在のプロセスが管理者権限で動いているか。machine スコープの winget 更新・導入は非管理者だと
 * 失敗するため、その分岐に使う。
 *
 * WindowsPrincipal.IsInRole を PowerShell 越しに評価する。`net session` 方式は Server サービスの
 * 状態に依存して誤判定しうるため採らない。判定できなければ false（安全側＝管理者でないとみなす）。
 */
export async function isElevated(): Promise<boolean> {
  const script =
    "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())" +
    ".IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)";
  const out = await $`powershell -NoProfile -NonInteractive -Command ${script}`.noThrow().text()
    .catch(() => "");
  return parseIsElevated(out);
}
