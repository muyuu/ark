import { assertEquals } from "@std/assert";
import { parseOverlays } from "./overlay.ts";

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
  const toml = '[[overlay]]\nname = "broken"\n';
  assertEquals(parseOverlays(toml), []);
});
