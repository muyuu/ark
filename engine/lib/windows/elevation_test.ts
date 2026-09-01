import { assertEquals } from "@std/assert";
import { parseIsElevated } from "./elevation.ts";

Deno.test("parseIsElevated: PowerShell の True / False を読む", () => {
  assertEquals(parseIsElevated("True\n"), true);
  assertEquals(parseIsElevated("False\n"), false);
});

Deno.test("parseIsElevated: 前後の空白・大小文字を無視する", () => {
  assertEquals(parseIsElevated("  true  "), true);
  assertEquals(parseIsElevated("TRUE\r\n"), true);
});

Deno.test("parseIsElevated: 判定不能（空文字・想定外）は false", () => {
  assertEquals(parseIsElevated(""), false);
  assertEquals(parseIsElevated("Access is denied."), false);
});
