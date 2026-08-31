import { assertEquals } from "@std/assert";
import {
  cargoBinName,
  cargoRustVersion,
  parseCargoVersion,
  satisfiesVersion,
  toolchainHint,
} from "./command.ts";

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

Deno.test("cargoRustVersion: [package].rust-version を読む（無ければ undefined）", () => {
  assertEquals(cargoRustVersion(`[package]\nname = "wt"\nrust-version = "1.78"\n`), "1.78");
  assertEquals(cargoRustVersion(`[package]\nname = "wt"\n`), undefined);
});

Deno.test("parseCargoVersion: cargo --version の出力から版を取り出す", () => {
  assertEquals(parseCargoVersion("cargo 1.74.1 (ecb9851af 2023-10-18)\n"), "1.74.1");
  assertEquals(parseCargoVersion("cargo 1.90.0-nightly (abc 2026-01-01)"), "1.90.0");
  assertEquals(parseCargoVersion(""), undefined);
});

Deno.test("satisfiesVersion: 必要な版を満たすか（桁数が違っても比べられる）", () => {
  assertEquals(satisfiesVersion("1.78.0", "1.78"), true);
  assertEquals(satisfiesVersion("1.90.0", "1.78"), true);
  assertEquals(satisfiesVersion("2.0.0", "1.78"), true);
  assertEquals(satisfiesVersion("1.74.1", "1.78"), false);
  assertEquals(satisfiesVersion("1.9.0", "1.78"), false);
  // 版が読めないときは止めない（判定できないことを理由にビルドを諦めない）
  assertEquals(satisfiesVersion(undefined, "1.78"), true);
});

Deno.test("toolchainHint: RUSTUP_TOOLCHAIN が効いていればそれを示す", () => {
  const hint = toolchainHint("1.74.1");

  assertEquals(hint.includes("RUSTUP_TOOLCHAIN=1.74.1"), true);
  assertEquals(hint.includes("rustup default"), false);
});

Deno.test("toolchainHint: 固定が無ければ rustup の更新を案内する", () => {
  assertEquals(toolchainHint("").includes("rustup default stable"), true);
});
