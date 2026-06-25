import { assertEquals } from "@std/assert";
import { compareVersions, osxAssetUrl, parseLatestVersion } from "./drumgizmo.ts";

Deno.test("compareVersions: 数値セグメントごとに比較し桁数差も扱う", () => {
  assertEquals(Math.sign(compareVersions("0.9.20", "0.9.8")), 1);
  assertEquals(Math.sign(compareVersions("0.9.20", "0.9.8.1")), 1);
  assertEquals(Math.sign(compareVersions("0.9.8", "0.9.20")), -1);
  assertEquals(compareVersions("0.9.20", "0.9.20"), 0);
});

Deno.test("parseLatestVersion: Apache の releases 一覧から最新 drumgizmo を選ぶ", () => {
  const html = [
    '<a href="dgedit-0.10.0/">dgedit-0.10.0/</a>',
    '<a href="drumgizmo-0.9.8.1/">drumgizmo-0.9.8.1/</a>',
    '<a href="drumgizmo-0.9.19/">drumgizmo-0.9.19/</a>',
    '<a href="drumgizmo-0.9.20/">drumgizmo-0.9.20/</a>',
  ].join("\n");
  // dgedit は対象外、最大バージョンを選ぶ
  assertEquals(parseLatestVersion(html), "0.9.20");
});

Deno.test("parseLatestVersion: 該当が無ければ空文字", () => {
  assertEquals(parseLatestVersion('<a href="dgedit-0.10.0/">x</a>'), "");
});

Deno.test("osxAssetUrl: バージョンから macOS 配布物の URL を組む", () => {
  assertEquals(
    osxAssetUrl("0.9.20"),
    "https://www.drumgizmo.org/releases/drumgizmo-0.9.20/drumgizmo-vst-osx-0.9.20.tar.gz",
  );
});
