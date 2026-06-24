import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { parseTrustedTaps, selectBrewfiles } from "./brew.ts";

Deno.test("parseTrustedTaps: 各行を tap 名として取り出す", () => {
  assertEquals(parseTrustedTaps("foo/bar\nbaz/qux\n"), ["foo/bar", "baz/qux"]);
});

Deno.test("parseTrustedTaps: 空行とコメント行を無視する", () => {
  const content = "foo/bar\n\n# これはコメント\nbaz/qux\n";
  assertEquals(parseTrustedTaps(content), ["foo/bar", "baz/qux"]);
});

Deno.test("parseTrustedTaps: 行内コメントと前後の空白を除去する", () => {
  assertEquals(parseTrustedTaps("  foo/bar   # tap の説明\n"), ["foo/bar"]);
});

Deno.test("selectBrewfiles: macOS では common と macos を選ぶ", () => {
  assertEquals(selectBrewfiles("darwin", "/repo"), [
    join("/repo/app/common/Brewfile"),
    join("/repo/app/macos/Brewfile"),
  ]);
});

Deno.test("selectBrewfiles: Linux では common のみ", () => {
  assertEquals(selectBrewfiles("linux", "/repo"), [join("/repo/app/common/Brewfile")]);
});

Deno.test("selectBrewfiles: Darwin/Linux 以外では common を選ばない", () => {
  assertEquals(selectBrewfiles("windows", "/repo"), []);
});
