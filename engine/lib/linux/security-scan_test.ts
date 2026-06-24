import { assert, assertEquals } from "@std/assert";
import { clamavHasInfection, rkhunterHasWarning } from "./security-scan.ts";

Deno.test("clamavHasInfection: 感染ファイルが 1 以上なら true", () => {
  assert(clamavHasInfection("----\nInfected files: 3\n"));
});

Deno.test("clamavHasInfection: 感染 0 件なら false", () => {
  assert(!clamavHasInfection("Infected files: 0\n"));
});

Deno.test("rkhunterHasWarning: Warning または Suspicious file を検出する", () => {
  assert(rkhunterHasWarning("Warning: something\n"));
  assert(rkhunterHasWarning("Suspicious file found\n"));
});

Deno.test("rkhunterHasWarning: 警告が無ければ false", () => {
  assert(!rkhunterHasWarning("All clear\n"));
  assertEquals(rkhunterHasWarning(""), false);
});
