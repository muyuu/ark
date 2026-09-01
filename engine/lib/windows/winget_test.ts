import { assertEquals } from "@std/assert";
import {
  installWithFallback,
  parseWingetfile,
  scopeAttempts,
  wingetIdName,
  wingetInstallArgv,
  wingetUpgradeArgv,
} from "./winget.ts";

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

Deno.test("wingetUpgradeArgv: 管理者なら --disable-interactivity を付けない", () => {
  assertEquals(wingetUpgradeArgv(true).includes("--disable-interactivity"), false);
});

Deno.test("wingetUpgradeArgv: 非管理者では --disable-interactivity で空振りさせる", () => {
  assertEquals(wingetUpgradeArgv(false).at(-1), "--disable-interactivity");
});

Deno.test("wingetInstallArgv: scope 無しなら --scope を付けない", () => {
  assertEquals(wingetInstallArgv("Rustlang.Rustup").includes("--scope"), false);
});

Deno.test("wingetInstallArgv: scope を渡すと末尾に --scope <scope>", () => {
  assertEquals(wingetInstallArgv("Git.Git", "machine").slice(-2), ["--scope", "machine"]);
});

Deno.test("scopeAttempts: user は user → スコープ無し", () => {
  assertEquals(scopeAttempts("user"), ["user", undefined]);
});

Deno.test("scopeAttempts: machine は machine → user → スコープ無し", () => {
  assertEquals(scopeAttempts("machine"), ["machine", "user", undefined]);
});

Deno.test("installWithFallback: 全部失敗すると試行順どおり呼んで false", async () => {
  const tried: Array<"machine" | "user" | undefined> = [];
  const ok = await installWithFallback("machine", (s) => {
    tried.push(s);
    return Promise.resolve(false);
  });
  assertEquals(ok, false);
  assertEquals(tried, ["machine", "user", undefined]);
});

Deno.test("installWithFallback: 最初に成功したところで止まる", async () => {
  const tried: Array<"machine" | "user" | undefined> = [];
  const ok = await installWithFallback("machine", (s) => {
    tried.push(s);
    return Promise.resolve(s === "user");
  });
  assertEquals(ok, true);
  assertEquals(tried, ["machine", "user"]);
});

Deno.test("installWithFallback: user 経路はスコープ無しにだけフォールバックする", async () => {
  const tried: Array<"machine" | "user" | undefined> = [];
  await installWithFallback("user", (s) => {
    tried.push(s);
    return Promise.resolve(false);
  });
  assertEquals(tried, ["user", undefined]);
});
