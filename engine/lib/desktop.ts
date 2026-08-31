import { isWsl } from "./linux/wsl.ts";

/**
 * デスクトップ環境か（デスクトップ層の宣言を適用する対象か）を判定する。副作用のない本体。
 *
 * - macOS / native Windows は常にデスクトップ。
 * - **WSL は対象外**。WSLg で GUI は動くが、ブラウザ・ファイルマネージャ・IME といった
 *   デスクトップの道具はホストの Windows 側にあり、WSL は開発環境として使う。
 * - それ以外の Linux は表示先（X11 / Wayland）の有無で決める。ssh 越しやコンテナのような
 *   headless では入れない。
 */
export function isDesktopEnv(
  os: string,
  wsl: boolean,
  display: string | undefined,
): boolean {
  if (os !== "linux") return true;
  if (wsl) return false;
  return (display ?? "") !== "";
}

/** 実行中の環境がデスクトップか。 */
export function isDesktop(): boolean {
  const display = Deno.env.get("WAYLAND_DISPLAY") ?? Deno.env.get("DISPLAY");
  return isDesktopEnv(Deno.build.os, isWsl(), display);
}
