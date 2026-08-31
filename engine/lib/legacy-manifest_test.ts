import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { renamedManifests } from "./legacy-manifest.ts";

// パスは OS の区切り文字で組み立てる（renamedManifests が join を使うため）。
const ROOT = join("/layer");

/** ROOT 配下の 1 ファイルだけが存在する述語。 */
function only(...parts: string[]): (path: string) => boolean {
  const target = join(ROOT, ...parts);
  return (path) => path === target;
}

Deno.test("renamedManifests: 旧名のファイルがあれば新名との対応を返す", () => {
  const found = renamedManifests(ROOT, only("app", "linux", "gui"));

  assertEquals(found, [{ old: "app/linux/gui", now: "app/linux/desktop" }]);
});

Deno.test("renamedManifests: 旧名が無ければ何も返さない", () => {
  assertEquals(renamedManifests(ROOT, () => false), []);
});

Deno.test("renamedManifests: custom の宣言形式が変わったものも拾う", () => {
  const found = renamedManifests(ROOT, only("app", "macos", "custom"));

  assertEquals(found, [{ old: "app/macos/custom", now: "app/macos/custom.toml" }]);
});
