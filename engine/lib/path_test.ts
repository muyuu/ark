import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { setupPath } from "./path.ts";
import { Logger } from "./logger.ts";

const quiet = new Logger("none");

async function withHome(fn: (home: string) => Promise<void>): Promise<void> {
  const home = await Deno.makeTempDir();
  try {
    await fn(home);
  } finally {
    await Deno.remove(home, { recursive: true });
  }
}

Deno.test("setupPath: brew があれば shellenv と mise を .bashrc に置く", async () => {
  await withHome(async (home) => {
    // パスは OS の区切り文字で組み立てる（detectBrewPrefix が join を使うため）。
    const brewBin = join("/opt/homebrew", "bin", "brew");
    await setupPath(home, quiet, (bin) => bin === brewBin);

    const bashrc = await Deno.readTextFile(join(home, ".bashrc"));
    assertEquals(bashrc.includes("/opt/homebrew/bin/brew shellenv"), true);
    assertEquals(bashrc.includes("mise activate bash"), true);
  });
});

Deno.test("setupPath: brew が無くても失敗せず mise だけ置く（brew を使わない構成を許す）", async () => {
  await withHome(async (home) => {
    await setupPath(home, quiet, () => false);

    const bashrc = await Deno.readTextFile(join(home, ".bashrc"));
    assertEquals(bashrc.includes("brew shellenv"), false);
    assertEquals(bashrc.includes("mise activate bash"), true);
  });
});
