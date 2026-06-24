import { assertEquals } from "@std/assert";
import { parseWingetfile } from "./winget.ts";

Deno.test("parseWingetfile: 1 行 1 ID を取り出しコメント/空行を無視する", () => {
  const content = "# CLI\nGit.Git\n\njdx.mise  \n# 末尾コメント\nNeovim.Neovim\n";
  assertEquals(parseWingetfile(content), ["Git.Git", "jdx.mise", "Neovim.Neovim"]);
});

Deno.test("parseWingetfile: 空内容なら空配列", () => {
  assertEquals(parseWingetfile(""), []);
});
