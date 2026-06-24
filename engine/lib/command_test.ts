import { assertEquals } from "@std/assert";
import { cargoBinName } from "./command.ts";

Deno.test("cargoBinName: [[bin]].name を優先する", () => {
  const toml = '[package]\nname = "pkg"\n\n[[bin]]\nname = "wt"\npath = "src/main.rs"\n';
  assertEquals(cargoBinName(toml), "wt");
});

Deno.test("cargoBinName: [[bin]] が無ければ [package].name", () => {
  assertEquals(cargoBinName('[package]\nname = "mytool"\nversion = "0.1.0"\n'), "mytool");
});

Deno.test("cargoBinName: どちらも無ければ undefined", () => {
  assertEquals(cargoBinName('[dependencies]\nanyhow = "1"\n'), undefined);
});
