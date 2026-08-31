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

/**
 * 開発機か（開発層の宣言を適用する対象か）を判定する。副作用のない本体。
 *
 * デスクトップに加えて WSL も開発機。逆に表示先の無い Linux（VPS・コンテナ）は、人が作業する
 * ためではなくサービスを載せるための箱なので対象外にする。
 */
export function isDevEnv(os: string, wsl: boolean, display: string | undefined): boolean {
  return isDesktopEnv(os, wsl, display) || wsl;
}

function currentDisplay(): string | undefined {
  return Deno.env.get("WAYLAND_DISPLAY") ?? Deno.env.get("DISPLAY");
}

/** 実行中の環境がデスクトップか。 */
export function isDesktop(): boolean {
  return isDesktopEnv(Deno.build.os, isWsl(), currentDisplay());
}

/** 実行中の環境が開発機か。 */
export function isDev(): boolean {
  return isDevEnv(Deno.build.os, isWsl(), currentDisplay());
}

/**
 * サーバか（サーバ層の宣言を適用する対象か）を判定する。副作用のない本体。
 *
 * 開発機の裏返し。サービスを載せる箱で、人はそこへ ssh して作業するだけ。
 * 層は「最小はどこでも、そのうえで用途別に server / dev / desktop」という形なので、
 * server と dev は排他になる。
 */
export function isServerEnv(os: string, wsl: boolean, display: string | undefined): boolean {
  return !isDevEnv(os, wsl, display);
}

/** 実行中の環境がサーバか。 */
export function isServer(): boolean {
  return isServerEnv(Deno.build.os, isWsl(), currentDisplay());
}
