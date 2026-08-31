import { assertEquals } from "@std/assert";
import { isDesktopEnv } from "./desktop.ts";

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
