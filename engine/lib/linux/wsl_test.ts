import { assertEquals } from "@std/assert";
import { isWslRelease } from "./wsl.ts";

Deno.test("isWslRelease: microsoft を含めば WSL", () => {
  assertEquals(isWslRelease("5.15.0-microsoft-standard-WSL2"), true);
});

Deno.test("isWslRelease: wsl を含めば WSL", () => {
  assertEquals(isWslRelease("Linux version ... WSL ..."), true);
});

Deno.test("isWslRelease: 通常の Linux カーネルは WSL でない", () => {
  assertEquals(isWslRelease("6.8.0-generic"), false);
});
