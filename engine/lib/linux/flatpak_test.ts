import { assertEquals } from "@std/assert";
import { conflictingPackages, parseFlatpakfile } from "./flatpak.ts";

Deno.test("parseFlatpakfile: アプリ ID を取り出す", () => {
  assertEquals(parseFlatpakfile("com.brave.Browser\ndev.zed.Zed\n"), [
    "com.brave.Browser",
    "dev.zed.Zed",
  ]);
});

Deno.test("parseFlatpakfile: コメント行・行内コメント・空行を無視する", () => {
  const content = "# ブラウザ\ncom.brave.Browser   # brave\n\n# 開発\ndev.zed.Zed\n";
  assertEquals(parseFlatpakfile(content), ["com.brave.Browser", "dev.zed.Zed"]);
});

Deno.test("conflictingPackages: 宣言されたアプリの競合分だけを返す", () => {
  assertEquals(conflictingPackages(["com.brave.Browser"]), ["brave-browser"]);
});

Deno.test("conflictingPackages: 競合を持たないアプリだけなら空になる（無関係な削除をしない）", () => {
  assertEquals(conflictingPackages(["org.musescore.MuseScore", "dev.zed.Zed"]), []);
});
