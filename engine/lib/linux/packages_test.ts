import { assertEquals } from "@std/assert";
import { mapPackageName, parsePackageMap, parseSystemPackages } from "./packages.ts";

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
  assertEquals(map.get("vscode"), "code");
  assertEquals(map.get("firacode"), "fonts-firacode");
});

Deno.test("parsePackageMap: コメント行・空行を無視する", () => {
  const map = parsePackageMap("# 開発ツール\n\nvscode=code\n");
  assertEquals(map.size, 1);
  assertEquals(map.get("vscode"), "code");
});

Deno.test("mapPackageName: マップにあれば実名、なければ論理名のまま", () => {
  const map = parsePackageMap("vscode=code\n");
  assertEquals(mapPackageName(map, "vscode"), "code");
  assertEquals(mapPackageName(map, "konsole"), "konsole");
});
