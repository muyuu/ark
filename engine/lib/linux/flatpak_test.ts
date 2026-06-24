import { assertEquals } from "@std/assert";
import { parseFlatpakfile } from "./flatpak.ts";

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
