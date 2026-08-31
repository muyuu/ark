import { assertEquals } from "@std/assert";
import { isDesktopEnv, isDevEnv, isServerEnv } from "./desktop.ts";

Deno.test("isDesktopEnv: macOS / Windows は常にデスクトップ", () => {
  assertEquals(isDesktopEnv("darwin", false, undefined), true);
  assertEquals(isDesktopEnv("windows", false, undefined), true);
});

Deno.test("isDesktopEnv: WSL は表示先があってもデスクトップ扱いしない", () => {
  // WSLg があるので DISPLAY は通るが、ブラウザ・IME などはホストの Windows 側にある。
  assertEquals(isDesktopEnv("linux", true, ":0"), false);
});

Deno.test("isDesktopEnv: Linux は表示先の有無で決める", () => {
  assertEquals(isDesktopEnv("linux", false, ":0"), true);
  assertEquals(isDesktopEnv("linux", false, "wayland-0"), true);
  assertEquals(isDesktopEnv("linux", false, undefined), false);
  assertEquals(isDesktopEnv("linux", false, ""), false);
});

Deno.test("isDevEnv: デスクトップと WSL は開発機", () => {
  assertEquals(isDevEnv("darwin", false, undefined), true);
  assertEquals(isDevEnv("linux", false, ":0"), true);
  assertEquals(isDevEnv("linux", true, ":0"), true);
});

Deno.test("isDevEnv: 表示先の無い Linux（サーバ）は開発機ではない", () => {
  assertEquals(isDevEnv("linux", false, undefined), false);
});

Deno.test("isServerEnv: 表示先の無い Linux だけがサーバ", () => {
  assertEquals(isServerEnv("linux", false, undefined), true);
  assertEquals(isServerEnv("linux", false, ""), true);
});

Deno.test("isServerEnv: 開発機（デスクトップ・WSL）はサーバではない", () => {
  assertEquals(isServerEnv("linux", false, ":0"), false);
  assertEquals(isServerEnv("linux", true, ":0"), false);
  assertEquals(isServerEnv("darwin", false, undefined), false);
  assertEquals(isServerEnv("windows", false, undefined), false);
});
