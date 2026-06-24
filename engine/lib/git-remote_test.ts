import { assertEquals } from "@std/assert";
import { githubHttpsToSsh } from "./git-remote.ts";

Deno.test("githubHttpsToSsh: HTTPS を SSH に変換する", () => {
  assertEquals(githubHttpsToSsh("https://github.com/muyuu/ark.git"), {
    status: "converted",
    url: "git@github.com:muyuu/ark.git",
  });
});

Deno.test("githubHttpsToSsh: .git 無し・末尾スラッシュも扱う", () => {
  assertEquals(githubHttpsToSsh("https://github.com/muyuu/ark/"), {
    status: "converted",
    url: "git@github.com:muyuu/ark.git",
  });
});

Deno.test("githubHttpsToSsh: 既に SSH なら already-ssh", () => {
  assertEquals(githubHttpsToSsh("git@github.com:muyuu/ark.git"), { status: "already-ssh" });
});

Deno.test("githubHttpsToSsh: github.com 以外は unsupported", () => {
  assertEquals(githubHttpsToSsh("https://gitlab.com/foo/bar.git"), { status: "unsupported" });
});
