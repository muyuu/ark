import { assertEquals } from "@std/assert";
import { githubSshConfig, hasGithubHost, publicKeyToken } from "./github.ts";

Deno.test("githubSshConfig: IdentityFile を含む Host ブロックを返す", () => {
  const block = githubSshConfig("/home/me/.ssh/id_ed25519");
  assertEquals(block.includes("Host github.com"), true);
  assertEquals(block.includes("IdentityFile /home/me/.ssh/id_ed25519"), true);
});

Deno.test("hasGithubHost: github.com の Host があれば true", () => {
  assertEquals(hasGithubHost("Host github.com\n  User git\n"), true);
  assertEquals(hasGithubHost("Host example.com\n"), false);
});

Deno.test("publicKeyToken: 2 番目のフィールド（鍵本体）を取り出す", () => {
  assertEquals(publicKeyToken("ssh-ed25519 AAAAC3Nz... me@host\n"), "AAAAC3Nz...");
  assertEquals(publicKeyToken(""), "");
});
