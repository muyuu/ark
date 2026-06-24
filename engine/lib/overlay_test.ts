import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { ghqPath, parseOverlays } from "./overlay.ts";

Deno.test("parseOverlays: [[overlay]] 配列を順序を保って取り出す", () => {
  const toml = `
[[overlay]]
name = "work"
url  = "git@github.com:org/ark-work.git"

[[overlay]]
name = "personal"
url  = "git@github.com:me/ark-personal.git"
`;
  assertEquals(parseOverlays(toml), [
    { name: "work", url: "git@github.com:org/ark-work.git" },
    { name: "personal", url: "git@github.com:me/ark-personal.git" },
  ]);
});

Deno.test("parseOverlays: 空内容は空配列", () => {
  assertEquals(parseOverlays(""), []);
});

Deno.test("parseOverlays: name/url が欠けたエントリは除外する", () => {
  assertEquals(parseOverlays('[[overlay]]\nname = "broken"\n'), []);
});

Deno.test("ghqPath: SSH URL を ghq ローカルパスに変換する", () => {
  assertEquals(
    ghqPath("/home/me/workspaces", "git@github.com:muyuu/ark-personal.git"),
    join("/home/me/workspaces", "github.com", "muyuu", "ark-personal"),
  );
});

Deno.test("ghqPath: HTTPS URL（.git 無し・末尾スラッシュ）も変換する", () => {
  assertEquals(
    ghqPath("/root", "https://github.com/muyuu/ark-work/"),
    join("/root", "github.com", "muyuu", "ark-work"),
  );
});

Deno.test("ghqPath: 解釈できない URL は undefined", () => {
  assertEquals(ghqPath("/root", "not-a-url"), undefined);
});
