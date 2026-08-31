import { assertEquals } from "@std/assert";
import { isNativeCommand, isWslRelease } from "./wsl.ts";

Deno.test("isWslRelease: microsoft を含めば WSL", () => {
  assertEquals(isWslRelease("5.15.0-microsoft-standard-WSL2"), true);
});

Deno.test("isWslRelease: wsl を含めば WSL", () => {
  assertEquals(isWslRelease("Linux version ... WSL ..."), true);
});

Deno.test("isWslRelease: 通常の Linux カーネルは WSL でない", () => {
  assertEquals(isWslRelease("6.8.0-generic"), false);
});

Deno.test("isNativeCommand: WSL が PATH に載せる Windows 側の実行ファイルを除く", () => {
  assertEquals(isNativeCommand("/usr/bin/zeditor"), true);
  assertEquals(isNativeCommand("/home/me/.local/bin/zed"), true);
  // WSL の interop は /mnt/c 配下の exe を PATH に載せる。これは Linux 側の導入ではない。
  assertEquals(isNativeCommand("/mnt/c/Users/me/AppData/Local/Programs/Zed/bin/zed"), false);
  assertEquals(isNativeCommand(""), false);
});
