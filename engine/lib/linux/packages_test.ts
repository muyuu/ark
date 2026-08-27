import { assertEquals } from "@std/assert";
import { mapPackageNames, parsePackageMap, parseSystemPackages } from "./packages.ts";

Deno.test("parseSystemPackages: 論理名を行ごとに取り出す", () => {
  assertEquals(parseSystemPackages("dolphin\nkonsole\n"), ["dolphin", "konsole"]);
});

Deno.test("parseSystemPackages: コメント行・空行を無視する", () => {
  const content = "# 見出し\n\ndolphin\n\n# 別の見出し\nkonsole\n";
  assertEquals(parseSystemPackages(content), ["dolphin", "konsole"]);
});

Deno.test("parseSystemPackages: 行内コメントを除き先頭トークンを取る", () => {
  const content = "nftables        # iptables の後継\nvscode          # Visual Studio Code\n";
  assertEquals(parseSystemPackages(content), ["nftables", "vscode"]);
});

Deno.test("parsePackageMap: 論理名=実名 を Map に解釈する", () => {
  const map = parsePackageMap("vscode=code\nfiracode=fonts-firacode\n");
  assertEquals(map.get("vscode"), ["code"]);
  assertEquals(map.get("firacode"), ["fonts-firacode"]);
});

Deno.test("parsePackageMap: 空白区切りで複数の実名に展開できる", () => {
  const map = parsePackageMap("fcitx5-frontends=fcitx5-gtk fcitx5-qt\n");
  assertEquals(map.get("fcitx5-frontends"), ["fcitx5-gtk", "fcitx5-qt"]);
});

Deno.test("parsePackageMap: コメント行・空行を無視する", () => {
  const map = parsePackageMap("# 開発ツール\n\nvscode=code\n");
  assertEquals(map.size, 1);
  assertEquals(map.get("vscode"), ["code"]);
});

Deno.test("mapPackageNames: マップにあれば実名、なければ論理名のまま", () => {
  const map = parsePackageMap("vscode=code\n");
  assertEquals(mapPackageNames(map, "vscode"), ["code"]);
  assertEquals(mapPackageNames(map, "konsole"), ["konsole"]);
});

Deno.test("mapPackageNames: 1 論理名を複数の実名へ展開する", () => {
  const map = parsePackageMap("fcitx5-frontends=fcitx5-gtk fcitx5-qt\n");
  assertEquals(mapPackageNames(map, "fcitx5-frontends"), ["fcitx5-gtk", "fcitx5-qt"]);
});
