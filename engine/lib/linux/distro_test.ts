import { assertEquals } from "@std/assert";
import { detectDistro } from "./distro.ts";

Deno.test("detectDistro: debian_version があれば debian/apt", () => {
  assertEquals(detectDistro((p) => p === "/etc/debian_version"), {
    name: "debian",
    packageManager: "apt",
  });
});

Deno.test("detectDistro: arch-release があれば arch/pacman", () => {
  assertEquals(detectDistro((p) => p === "/etc/arch-release"), {
    name: "arch",
    packageManager: "pacman",
  });
});

Deno.test("detectDistro: fedora-release があれば fedora/dnf", () => {
  assertEquals(detectDistro((p) => p === "/etc/fedora-release"), {
    name: "fedora",
    packageManager: "dnf",
  });
});

Deno.test("detectDistro: redhat-release は fedora/dnf に寄せる", () => {
  assertEquals(detectDistro((p) => p === "/etc/redhat-release"), {
    name: "fedora",
    packageManager: "dnf",
  });
});

Deno.test("detectDistro: 該当なしは undefined", () => {
  assertEquals(detectDistro(() => false), undefined);
});
