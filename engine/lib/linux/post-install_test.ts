import { assertEquals } from "@std/assert";
import { dockerGroupUser } from "./post-install.ts";

Deno.test("dockerGroupUser: USER があればそれを使う", () => {
  assertEquals(dockerGroupUser("me", "fallback"), "me");
});

Deno.test("dockerGroupUser: USER が無ければ id -un の結果を使う", () => {
  assertEquals(dockerGroupUser(undefined, "me"), "me");
});

Deno.test("dockerGroupUser: 空白だけの値は無いものとして扱う", () => {
  assertEquals(dockerGroupUser("  ", "me\n"), "me");
});

Deno.test("dockerGroupUser: どちらも取れなければ undefined（空のまま usermod を叩かない）", () => {
  assertEquals(dockerGroupUser(undefined, ""), undefined);
});
