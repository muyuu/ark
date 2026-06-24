/** /proc のカーネル情報文字列が WSL を示すか（"microsoft" / "wsl" を含むかで判定）。 */
export function isWslRelease(content: string): boolean {
  return /microsoft|wsl/i.test(content);
}

/**
 * 現在の環境が WSL かどうか。Linux 以外では常に false。
 * WSL は headless（GUI はホスト Windows 側）なので、GUI 層を入れるかの分岐に使う。
 */
export function isWsl(): boolean {
  if (Deno.build.os !== "linux") return false;
  for (const path of ["/proc/sys/kernel/osrelease", "/proc/version"]) {
    try {
      return isWslRelease(Deno.readTextFileSync(path));
    } catch {
      continue;
    }
  }
  return false;
}
