import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { setupZsh } from "./zsh.ts";

async function withTempHome(fn: (home: string) => Promise<void>): Promise<void> {
  const home = await Deno.makeTempDir();
  try {
    await fn(home);
  } finally {
    await Deno.remove(home, { recursive: true });
  }
}

Deno.test("setupZsh: .bashrc に zsh へ切り替える fallback を追記する", async () => {
  await withTempHome(async (home) => {
    await setupZsh(home);
    const bashrc = await Deno.readTextFile(join(home, ".bashrc"));
    assertEquals(bashrc.includes("exec zsh"), true);
  });
});

Deno.test("setupZsh: 再実行しても重複追記しない", async () => {
  await withTempHome(async (home) => {
    await setupZsh(home);
    await setupZsh(home);
    const bashrc = await Deno.readTextFile(join(home, ".bashrc"));
    const count = bashrc.split("exec zsh").length - 1;
    assertEquals(count, 1);
  });
});
