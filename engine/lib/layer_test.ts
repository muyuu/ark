import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { collect, type Layer, manifestPath, readManifest } from "./layer.ts";

// パスは OS の区切り文字で組み立てる（manifestPath が join を使うため）。
const CORE: Layer = { name: "core", root: join("/repo") };

Deno.test("manifestPath: layer のルートからの相対パスを組み立てる", () => {
  assertEquals(manifestPath(CORE, "app/linux/packages"), join("/repo", "app", "linux", "packages"));
});

async function withLayers(
  files: Record<string, string>,
  fn: (layers: Layer[]) => Promise<void>,
): Promise<void> {
  const base = await Deno.makeTempDir();
  try {
    const layers: Layer[] = [
      { name: "core", root: join(base, "core") },
      { name: "personal", root: join(base, "personal") },
    ];
    for (const [path, content] of Object.entries(files)) {
      const full = join(base, ...path.split("/"));
      await Deno.mkdir(join(full, ".."), { recursive: true });
      await Deno.writeTextFile(full, content);
    }
    await fn(layers);
  } finally {
    await Deno.remove(base, { recursive: true });
  }
}

Deno.test("readManifest: 無い manifest は空文字（layer ごとに任意）", async () => {
  await withLayers({ "core/app/x": "a\n" }, async ([core, personal]) => {
    assertEquals(await readManifest(core, "app/x"), "a\n");
    assertEquals(await readManifest(personal, "app/x"), "");
  });
});

Deno.test("collect: 合成順に読んで連結する（後の layer が後ろに来る）", async () => {
  const files = { "core/app/x": "a\nb\n", "personal/app/x": "c\n" };
  await withLayers(files, async (layers) => {
    const lines = await collect(layers, "app/x", (text) => text.split("\n").filter(Boolean));

    assertEquals(lines, ["a", "b", "c"]);
  });
});

Deno.test("collect: manifest を持たない layer は飛ばす", async () => {
  await withLayers({ "personal/app/x": "c\n" }, async (layers) => {
    const lines = await collect(layers, "app/x", (text) => text.split("\n").filter(Boolean));

    assertEquals(lines, ["c"]);
  });
});
