import { assertEquals } from "@std/assert";
import {
  detectArchSuffix,
  installedVersionDigits,
  latestVersionDigits,
  parseLatestRelativePath,
} from "./reaper.ts";

Deno.test("detectArchSuffix: uname -m を REAPER の arch 文字列に変換する", () => {
  assertEquals(detectArchSuffix("x86_64"), "linux_x86_64");
  assertEquals(detectArchSuffix("aarch64"), "linux_aarch64");
  assertEquals(detectArchSuffix("arm64"), "linux_aarch64");
  assertEquals(detectArchSuffix("i686"), "linux_i686");
  assertEquals(detectArchSuffix("i386"), "linux_i686");
  assertEquals(detectArchSuffix("armv7l"), "linux_armv7l");
  assertEquals(detectArchSuffix("mips"), "");
});

Deno.test("parseLatestRelativePath: ダウンロードページから arch 一致の相対パスを取り出す", () => {
  const html = `<a href="files/7.x/reaper721_linux_x86_64.tar.xz">dl</a>
                <a href="files/7.x/reaper721_linux_aarch64.tar.xz">dl</a>`;
  assertEquals(
    parseLatestRelativePath(html, "linux_x86_64"),
    "files/7.x/reaper721_linux_x86_64.tar.xz",
  );
});

Deno.test("parseLatestRelativePath: 一致が無ければ undefined", () => {
  assertEquals(parseLatestRelativePath("no links here", "linux_x86_64"), undefined);
});

Deno.test("latestVersionDigits: 相対パスからバージョン桁を取り出す", () => {
  assertEquals(latestVersionDigits("files/7.x/reaper721_linux_x86_64.tar.xz"), "721");
});

Deno.test("installedVersionDigits: --version 出力から x.y を取りドットを除く", () => {
  assertEquals(installedVersionDigits("REAPER v7.21/linux-x86_64"), "721");
  assertEquals(installedVersionDigits("no version"), "");
});
