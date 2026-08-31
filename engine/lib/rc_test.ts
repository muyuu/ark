import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { detectBrewPrefix, ensureRcBlock, rcBlock } from "./rc.ts";

Deno.test("detectBrewPrefix: linuxbrew を最優先する", () => {
  const prefix = detectBrewPrefix("/home/me", () => true);
  assertEquals(prefix, "/home/linuxbrew/.linuxbrew");
});

Deno.test("detectBrewPrefix: $HOME/.linuxbrew も候補に含む", () => {
  const home = "/home/me";
  const onlyHome = join(home, ".linuxbrew", "bin", "brew");
  assertEquals(detectBrewPrefix(home, (p) => p === onlyHome), join(home, ".linuxbrew"));
});

Deno.test("detectBrewPrefix: /usr/local があっても brew 実体が無ければ選ばない", () => {
  assertEquals(detectBrewPrefix("/home/me", () => false), undefined);
});

const BLOCK = rcBlock("# >>> test <<<", "# <<< test >>>", ["echo new"]);

async function withRc(initial: string | undefined, fn: (path: string) => Promise<void>) {
  const dir = await Deno.makeTempDir();
  try {
    const path = join(dir, ".bashrc");
    if (initial !== undefined) await Deno.writeTextFile(path, initial);
    await fn(path);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test("ensureRcBlock: 無ければ末尾に追記する", async () => {
  await withRc("export A=1\n", async (path) => {
    assertEquals(await ensureRcBlock(path, BLOCK), true);

    const text = await Deno.readTextFile(path);
    assertEquals(text.startsWith("export A=1\n"), true);
    assertEquals(text.includes("echo new"), true);
  });
});

Deno.test("ensureRcBlock: 同じ内容なら書き換えない", async () => {
  await withRc(`export A=1\n\n${BLOCK.body}\n`, async (path) => {
    assertEquals(await ensureRcBlock(path, BLOCK), false);
  });
});

Deno.test("ensureRcBlock: 内容が変わったら既存ブロックだけを差し替える", async () => {
  const old = "# >>> test <<<\necho old\n# <<< test >>>";
  await withRc(`before\n\n${old}\n\nafter\n`, async (path) => {
    assertEquals(await ensureRcBlock(path, BLOCK), true);

    const text = await Deno.readTextFile(path);
    assertEquals(text, `before\n\n${BLOCK.body}\n\nafter\n`);
  });
});
