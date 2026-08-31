import { assertEquals } from "@std/assert";
import { renamedManifests } from "./legacy-manifest.ts";

Deno.test("renamedManifests: 旧名のファイルがあれば新名との対応を返す", () => {
  const found = renamedManifests("/layer", (p) => p === "/layer/app/linux/gui");

  assertEquals(found, [{ old: "app/linux/gui", now: "app/linux/desktop" }]);
});

Deno.test("renamedManifests: 旧名が無ければ何も返さない", () => {
  assertEquals(renamedManifests("/layer", () => false), []);
});

Deno.test("renamedManifests: custom の宣言形式が変わったものも拾う", () => {
  const found = renamedManifests("/layer", (p) => p.endsWith("app/macos/custom"));

  assertEquals(found, [{ old: "app/macos/custom", now: "app/macos/custom.toml" }]);
});
