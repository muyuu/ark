import { assertEquals } from "@std/assert";
import { GITHUB_KEY_DECL, isKeyRegistered, publicKeyToken } from "./github.ts";

Deno.test("publicKeyToken: 2 番目のフィールド（鍵本体）を取り出す", () => {
  assertEquals(publicKeyToken("ssh-ed25519 AAAAC3Nz... me@host\n"), "AAAAC3Nz...");
  assertEquals(publicKeyToken(""), "");
});

Deno.test("isKeyRegistered: 登録一覧に鍵本体があれば true", () => {
  const list = "hostname\tssh-ed25519 AAAAC3Nz...\t2026-01-01\n";

  assertEquals(isKeyRegistered(list, "ssh-ed25519 AAAAC3Nz... me@host"), true);
  assertEquals(isKeyRegistered(list, "ssh-ed25519 BBBBdifferent me@host"), false);
});

Deno.test("isKeyRegistered: 公開鍵が読めなければ登録済みとみなさない", () => {
  assertEquals(isKeyRegistered("hostname\tssh-ed25519 AAAAC3Nz...\t2026-01-01\n", ""), false);
});

Deno.test("GITHUB_KEY_DECL: 既定鍵は github.com へ User git で固定する", () => {
  assertEquals(GITHUB_KEY_DECL.name, "default");
  assertEquals(GITHUB_KEY_DECL.host, "github.com");
  assertEquals(GITHUB_KEY_DECL.user, "git");
});
