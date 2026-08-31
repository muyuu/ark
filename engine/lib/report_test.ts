import { assertEquals } from "@std/assert";
import { InstallReport } from "./report.ts";

Deno.test("InstallReport: 何も起きなければ失敗なし", () => {
  const report = new InstallReport();

  assertEquals(report.hasFailures, false);
  assertEquals(report.summary(), []);
});

Deno.test("InstallReport: 同じ経路の失敗はまとめて 1 行にする", () => {
  const report = new InstallReport();
  report.record("apt", "dolphin");
  report.record("apt", "konsole");
  report.record("custom", "reaper");

  assertEquals(report.hasFailures, true);
  assertEquals(report.summary(), [
    "apt: dolphin, konsole",
    "custom: reaper",
  ]);
});

Deno.test("InstallReport: 経路は最初に出た順で並べる", () => {
  const report = new InstallReport();
  report.record("custom", "zed");
  report.record("apt", "vim");
  report.record("custom", "ghostty");

  assertEquals(report.summary(), ["custom: zed, ghostty", "apt: vim"]);
});

Deno.test("InstallReport: 同じものを二重に数えない", () => {
  const report = new InstallReport();
  report.record("apt", "vim");
  report.record("apt", "vim");

  assertEquals(report.summary(), ["apt: vim"]);
});
