import { assertEquals } from "@std/assert";
import { ghosttyInstallMethod } from "./ghostty.ts";

Deno.test("ghosttyInstallMethod: PM に公式パッケージがある distro はそのまま PM", () => {
  assertEquals(ghosttyInstallMethod("arch", false), "pacman");
  assertEquals(ghosttyInstallMethod("fedora", false), "dnf");
});

Deno.test("ghosttyInstallMethod: Debian 系は apt に候補があれば PPA を足さない", () => {
  assertEquals(ghosttyInstallMethod("debian", true), "apt");
  assertEquals(ghosttyInstallMethod("debian", false), "apt-ppa");
});

Deno.test("ghosttyInstallMethod: distro 判定不能なら Debian 系として扱う", () => {
  assertEquals(ghosttyInstallMethod(undefined, true), "apt");
  assertEquals(ghosttyInstallMethod(undefined, false), "apt-ppa");
});
