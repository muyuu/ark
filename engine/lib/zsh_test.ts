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

/** PATH の先頭に置く偽の zsh。切り替わったかどうかを標準出力で判別する。 */
async function fakeZshDir(): Promise<string> {
  const dir = await Deno.makeTempDir();
  const zsh = join(dir, "zsh");
  await Deno.writeTextFile(zsh, "#!/bin/sh\necho SWITCHED\n");
  await Deno.chmod(zsh, 0o755);
  return dir;
}

/** 生成された .bashrc を bash に読ませ、標準出力を返す。interactive で対話シェルとして起動する。 */
async function runBash(home: string, binDir: string, interactive: boolean): Promise<string> {
  const args = interactive ? ["-i", "-c", "echo OK"] : ["-c", "echo OK"];
  const cmd = new Deno.Command("bash", {
    args,
    env: {
      HOME: home,
      // 非対話 bash が rc を読む経路（ssh <command> / scp が使うのと同じ仕組み）。
      BASH_ENV: join(home, ".bashrc"),
      PATH: `${binDir}:${Deno.env.get("PATH") ?? ""}`,
    },
    stdout: "piped",
    stderr: "null",
  });
  return new TextDecoder().decode((await cmd.output()).stdout);
}

Deno.test({
  name: "setupZsh: 非対話 bash では zsh へ切り替えない（ssh <command> / scp を壊さない）",
  ignore: Deno.build.os === "windows",
  async fn() {
    await withTempHome(async (home) => {
      await setupZsh(home);
      const binDir = await fakeZshDir();
      try {
        const out = await runBash(home, binDir, false);

        assertEquals(out.includes("SWITCHED"), false);
        assertEquals(out.includes("OK"), true);
      } finally {
        await Deno.remove(binDir, { recursive: true });
      }
    });
  },
});

Deno.test({
  name: "setupZsh: 対話 bash では zsh へ切り替える",
  ignore: Deno.build.os === "windows",
  async fn() {
    await withTempHome(async (home) => {
      await setupZsh(home);
      const binDir = await fakeZshDir();
      try {
        const out = await runBash(home, binDir, true);

        assertEquals(out.includes("SWITCHED"), true);
      } finally {
        await Deno.remove(binDir, { recursive: true });
      }
    });
  },
});

Deno.test({
  name: "setupZsh: 対話判定の無い古いブロックを差し替える（導入済みマシンにも修正が届く）",
  ignore: Deno.build.os === "windows",
  async fn() {
    await withTempHome(async (home) => {
      const old = [
        "# >>> zsh fallback <<<",
        "if command -v zsh >/dev/null 2>&1; then",
        "  exec zsh",
        "fi",
        "# <<< zsh fallback >>>",
      ].join("\n");
      await Deno.writeTextFile(join(home, ".bashrc"), `export A=1\n\n${old}\n`);

      await setupZsh(home);

      const binDir = await fakeZshDir();
      try {
        assertEquals((await runBash(home, binDir, false)).includes("SWITCHED"), false);
        assertEquals((await Deno.readTextFile(join(home, ".bashrc"))).includes("export A=1"), true);
      } finally {
        await Deno.remove(binDir, { recursive: true });
      }
    });
  },
});
