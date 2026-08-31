import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  hasHostBlock,
  keyFile,
  mergeKeyDecls,
  parseKeyDecls,
  resolveKeys,
  sshConfigBlock,
} from "./ssh.ts";

// パスは OS の区切り文字で組み立てる（keyFile が join を使うため、期待値も同じ形にする）。
const HOME = join("/home/me");

/** ~/.ssh 配下の期待パス。 */
function sshPath(base: string): string {
  return join(HOME, ".ssh", base);
}

Deno.test("keyFile: 既定鍵は id_ed25519、用途別の鍵は名前を接尾辞にする", () => {
  assertEquals(keyFile(HOME, "default"), sshPath("id_ed25519"));
  assertEquals(keyFile(HOME, "work"), sshPath("id_ed25519_work"));
});

Deno.test("resolveKeys: 宣言に鍵ファイルのパスを与える", () => {
  const keys = resolveKeys(HOME, [
    { name: "default", host: "github.com" },
    { name: "work", host: "github.com-work" },
  ]);

  assertEquals(keys.length, 2);
  assertEquals(keys[0].file, sshPath("id_ed25519"));
  assertEquals(keys[1].file, sshPath("id_ed25519_work"));
});

Deno.test("parseKeyDecls: [[key]] を順序を保って読み、name の無いものは捨てる", () => {
  const decls = parseKeyDecls(`
[[key]]
name = "default"
host = "github.com"

[[key]]
host = "example.com"

[[key]]
name = "work"
host = "github.com-work"
comment = "me@work"
`);

  assertEquals(decls.length, 2);
  assertEquals(decls[0], { name: "default", host: "github.com" });
  assertEquals(decls[1], { name: "work", host: "github.com-work", comment: "me@work" });
});

Deno.test("mergeKeyDecls: 同名は後の layer が勝ち、初出の順序を保つ", () => {
  const machine = [{ name: "default", host: "github.com" }, { name: "work", host: "old" }];
  const overlay = [{ name: "work", host: "github.com-work" }, { name: "lab", host: "lab.example" }];

  assertEquals(mergeKeyDecls(machine, overlay), [
    { name: "default", host: "github.com" },
    { name: "work", host: "github.com-work" },
    { name: "lab", host: "lab.example" },
  ]);
});

Deno.test("sshConfigBlock: 鍵を固定する Host ブロックを返す", () => {
  const block = sshConfigBlock({
    name: "default",
    host: "github.com",
    user: "git",
    file: "/home/me/.ssh/id_ed25519",
  });

  assertEquals(block.includes("Host github.com\n"), true);
  assertEquals(block.includes("HostName github.com\n"), true);
  assertEquals(block.includes("User git\n"), true);
  assertEquals(block.includes("IdentityFile /home/me/.ssh/id_ed25519\n"), true);
  assertEquals(block.includes("IdentitiesOnly yes\n"), true);
});

Deno.test("sshConfigBlock: エイリアスは HostName で実ホストへ向け、User 未指定なら書かない", () => {
  const block = sshConfigBlock({
    name: "work",
    host: "github.com-work",
    hostname: "github.com",
    file: "/home/me/.ssh/id_ed25519_work",
  });

  assertEquals(block.includes("Host github.com-work\n"), true);
  assertEquals(block.includes("HostName github.com\n"), true);
  assertEquals(block.includes("User "), false);
});

Deno.test("hasHostBlock: Host 名が前方一致する別ホストを取り違えない", () => {
  const config = "Host github.com-work\n    HostName github.com\n";

  assertEquals(hasHostBlock(config, "github.com-work"), true);
  assertEquals(hasHostBlock(config, "github.com"), false);
});
