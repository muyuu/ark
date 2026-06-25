import { assertEquals } from "@std/assert";
import { zedInstallMethod } from "./zed.ts";

Deno.test("zedInstallMethod: Arch は PM、それ以外は install スクリプト", () => {
  assertEquals(zedInstallMethod("arch"), "pacman");
  assertEquals(zedInstallMethod("debian"), "script");
  assertEquals(zedInstallMethod("fedora"), "script");
  assertEquals(zedInstallMethod(undefined), "script");
});
