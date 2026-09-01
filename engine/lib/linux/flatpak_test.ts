import { assertEquals } from "@std/assert";
import {
  conflictingPackages,
  conflictPurgeList,
  type FlatpakShell,
  parseFlatpakfile,
  setupFlatpak,
} from "./flatpak.ts";
import { InstallReport } from "../report.ts";

Deno.test("parseFlatpakfile: アプリ ID を取り出す", () => {
  assertEquals(parseFlatpakfile("com.brave.Browser\ndev.zed.Zed\n"), [
    "com.brave.Browser",
    "dev.zed.Zed",
  ]);
});

Deno.test("parseFlatpakfile: コメント行・行内コメント・空行を無視する", () => {
  const content = "# ブラウザ\ncom.brave.Browser   # brave\n\n# 開発\ndev.zed.Zed\n";
  assertEquals(parseFlatpakfile(content), ["com.brave.Browser", "dev.zed.Zed"]);
});

Deno.test("conflictingPackages: 宣言されたアプリの競合分だけを返す", () => {
  assertEquals(conflictingPackages(["com.brave.Browser"]), ["brave-browser"]);
});

Deno.test("conflictingPackages: 競合を持たないアプリだけなら空になる（無関係な削除をしない）", () => {
  assertEquals(conflictingPackages(["org.musescore.MuseScore", "dev.zed.Zed"]), []);
});

Deno.test("conflictPurgeList: 競合の論理名を distro map で実名へ解決する", () => {
  const map = new Map([["brave-browser", ["brave-bin"]]]);
  assertEquals(conflictPurgeList(["com.brave.Browser"], map), ["brave-bin"]);
});

Deno.test("conflictPurgeList: map に無ければ論理名のまま（Debian は brave-browser 素通り）", () => {
  assertEquals(conflictPurgeList(["com.brave.Browser"], new Map()), ["brave-browser"]);
});

function fakeShell(overrides: Partial<FlatpakShell> = {}) {
  const calls: string[][] = [];
  const shell: FlatpakShell = {
    hasFlatpak: () => Promise.resolve(true),
    run: (argv) => {
      calls.push(argv);
      return Promise.resolve();
    },
    tryRun: (argv) => {
      calls.push(argv);
      return Promise.resolve(0);
    },
    ...overrides,
  };
  return { shell, calls };
}

async function withFlatpakfile(body: string, fn: (path: string) => Promise<void>): Promise<void> {
  const path = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(path, body);
    await fn(path);
  } finally {
    await Deno.remove(path);
  }
}

Deno.test("setupFlatpak: 宣言が空なら何もしない", async () => {
  await withFlatpakfile("\n# コメントだけ\n", async (path) => {
    const { shell, calls } = fakeShell();
    await setupFlatpak("apt", path, new Map(), shell, new InstallReport());
    assertEquals(calls, []);
  });
});

Deno.test("setupFlatpak: 競合する distro 版を map 解決した実名で purge する", async () => {
  await withFlatpakfile("com.brave.Browser\n", async (path) => {
    const map = new Map([["brave-browser", ["brave-bin"]]]);
    const { shell, calls } = fakeShell();
    await setupFlatpak("pacman", path, map, shell, new InstallReport());

    const purge = calls.find((c) => c.includes("purge") || c.includes("-Rns"));
    assertEquals(purge?.includes("brave-bin"), true);
  });
});

Deno.test("setupFlatpak: 競合が無ければ purge を呼ばない（無関係な削除をしない）", async () => {
  await withFlatpakfile("dev.zed.Zed\n", async (path) => {
    const { shell, calls } = fakeShell();
    await setupFlatpak("apt", path, new Map(), shell, new InstallReport());

    assertEquals(calls.some((c) => c.includes("purge")), false);
  });
});

Deno.test("setupFlatpak: 導入に失敗したアプリだけ report に記録する", async () => {
  await withFlatpakfile("ok.App\nbad.App\n", async (path) => {
    const rep = new InstallReport();
    const { shell } = fakeShell({
      tryRun: (argv) => Promise.resolve(argv.at(-1) === "bad.App" ? 1 : 0),
    });
    await setupFlatpak("apt", path, new Map(), shell, rep);

    assertEquals(rep.summary(), ["flatpak: bad.App"]);
  });
});

Deno.test("setupFlatpak: flatpak 未導入なら distro PM で入れてから進む", async () => {
  await withFlatpakfile("some.App\n", async (path) => {
    const { shell, calls } = fakeShell({ hasFlatpak: () => Promise.resolve(false) });
    await setupFlatpak("apt", path, new Map(), shell, new InstallReport());

    assertEquals(calls[0], ["sudo", "apt", "install", "-y", "flatpak"]);
  });
});
