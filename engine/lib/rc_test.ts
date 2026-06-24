import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { detectBrewPrefix } from "./rc.ts";

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
