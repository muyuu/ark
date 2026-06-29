import { assertEquals } from "@std/assert";
import { parseWingetfile, wingetIdName } from "./winget.ts";

Deno.test("parseWingetfile: 1 行 1 ID を取り出しコメント/空行を無視する", () => {
  const content = "# CLI\nGit.Git\n\njdx.mise  \n# 末尾コメント\nNeovim.Neovim\n";
  assertEquals(parseWingetfile(content), ["Git.Git", "jdx.mise", "Neovim.Neovim"]);
});

Deno.test("parseWingetfile: 空内容なら空配列", () => {
  assertEquals(parseWingetfile(""), []);
});

Deno.test("parseWingetfile: CRLF 改行でもコメント行・行内コメントを除去する", () => {
  const content = "# CLI\r\nGit.Git\r\nx-motemen.ghq  # ghq\r\n";
  assertEquals(parseWingetfile(content), ["Git.Git", "x-motemen.ghq"]);
});

Deno.test("wingetIdName: ドット以降の名前部分を取り出す", () => {
  assertEquals(wingetIdName("Dropbox.Dropbox"), "Dropbox");
  assertEquals(wingetIdName("Microsoft.VisualStudioCode"), "VisualStudioCode");
});

Deno.test("wingetIdName: 多段のドットでも最後の要素を返す", () => {
  assertEquals(wingetIdName("AgileBits.1Password.Beta"), "Beta");
});

Deno.test("wingetIdName: ドットが無ければそのまま返す", () => {
  assertEquals(wingetIdName("Dropbox"), "Dropbox");
});
