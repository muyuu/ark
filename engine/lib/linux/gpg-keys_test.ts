import { assertEquals } from "@std/assert";
import { parseGpgKeys, substituteKeyPath } from "./gpg-keys.ts";

Deno.test("parseGpgKeys: name / url / source 行を取り出す（外側クォートのみ除去）", () => {
  const content =
    'docker https://example.com/gpg "deb [signed-by=__KEY_PATH__] https://example.com x main"\n';
  assertEquals(parseGpgKeys(content), [{
    name: "docker",
    url: "https://example.com/gpg",
    sourceLine: "deb [signed-by=__KEY_PATH__] https://example.com x main",
  }]);
});

Deno.test("parseGpgKeys: コメント行・空行を無視する", () => {
  const content = '# 見出し\n\nfoo https://e/x "deb x"\n';
  assertEquals(parseGpgKeys(content).length, 1);
});

Deno.test("substituteKeyPath: __KEY_PATH__ を全置換する", () => {
  assertEquals(
    substituteKeyPath("signed-by=__KEY_PATH__ ... __KEY_PATH__", "/etc/apt/keyrings/foo.gpg"),
    "signed-by=/etc/apt/keyrings/foo.gpg ... /etc/apt/keyrings/foo.gpg",
  );
});
