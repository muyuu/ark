import { join } from "@std/path";
import { parse as parseToml } from "@std/toml";
import { ensureDir } from "@std/fs";
import { $ } from "@david/dax";
import { log } from "./logger.ts";

/** Cargo.toml からビルド成果物のバイナリ名を得る（`[[bin]].name` 優先、無ければ `[package].name`）。 */
export function cargoBinName(cargoToml: string): string | undefined {
  const parsed = parseToml(cargoToml) as {
    bin?: Array<{ name?: string }>;
    package?: { name?: string };
  };
  return parsed.bin?.[0]?.name ?? parsed.package?.name;
}

/** Cargo.toml が要求する最小の Rust 版（`[package].rust-version`）。宣言が無ければ undefined。 */
export function cargoRustVersion(cargoToml: string): string | undefined {
  const parsed = parseToml(cargoToml) as { package?: { "rust-version"?: string } };
  const version = parsed.package?.["rust-version"];
  return typeof version === "string" ? version : undefined;
}

/** `cargo --version` の出力から版を取り出す（例: `cargo 1.74.1 (…)` → `1.74.1`）。 */
export function parseCargoVersion(output: string): string | undefined {
  return output.match(/^cargo\s+(\d+(?:\.\d+)*)/)?.[1];
}

/**
 * actual が required 以上か。桁数が違っても比べられる（`1.78.0` と `1.78`）。
 *
 * actual が読めないときは true を返す。版を確かめられないことを理由にビルドを諦めない
 * （実際にビルドすれば cargo 自身が正しく判断する）。
 */
export function satisfiesVersion(actual: string | undefined, required: string): boolean {
  if (actual === undefined) return true;

  const parts = (v: string) => v.split(".").map(Number);
  const [a, r] = [parts(actual), parts(required)];
  for (let i = 0; i < Math.max(a.length, r.length); i++) {
    const [x, y] = [a[i] ?? 0, r[i] ?? 0];
    if (x !== y) return x > y;
  }
  return true;
}

async function readTextOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return undefined;
    throw err;
  }
}

async function forceSymlink(source: string, target: string): Promise<void> {
  try {
    await Deno.remove(target);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  await Deno.symlink(source, target);
}

/** このマシンの cargo の版（取れなければ undefined）。 */
async function cargoVersion(): Promise<string | undefined> {
  return parseCargoVersion(await $`mise exec -- cargo --version`.noThrow().text());
}

/**
 * Cargo プロジェクト 1 つをビルドして `~/.local/bin` に置く。成功したら true。
 *
 * 失敗しても例外は投げない。自前コマンドが 1 つ壊れていても、dotfiles やパッケージの適用まで
 * 巻き添えにしないため。
 */
async function buildCargoCommand(
  name: string,
  dir: string,
  cargoToml: string,
  binDir: string,
  cargo: string | undefined,
): Promise<boolean> {
  const required = cargoRustVersion(cargoToml);
  if (required && !satisfiesVersion(cargo, required)) {
    log.warning(
      `⚠️ command/${name}: cargo ${cargo} は古すぎます（${required} 以上が必要）。ビルドをスキップします`,
    );
    log.warning("   → rustup を使っているなら `rustup default stable` で更新できます");
    return false;
  }

  const bin = cargoBinName(cargoToml) ?? name;
  log.info(`🔨 command/${name} をビルドします...`);
  if ((await $`mise exec -- cargo build --release`.cwd(dir).noThrow()).code !== 0) {
    log.warning(`⚠️ command/${name}: ビルドに失敗しました。スキップします`);
    return false;
  }

  const link = join(binDir, bin);
  await forceSymlink(join(dir, "target", "release", bin), link);
  log.success(`✅ ${bin} → ${link}`);
  return true;
}

/**
 * command/ 配下の自前コマンドをビルドして `~/.local/bin` に配置する。
 *
 * サブディレクトリを種類で判定して個別にビルドする（現状 Cargo.toml = Rust の `cargo build --release`）。
 * 生成物は `~/.local/bin/<name>` に symlink する（再ビルドで自動反映される）。Cargo プロジェクトでない
 * ディレクトリはスキップする。Windows は既定でビルドをスキップする（rust(MSVC) のリンカ前提を避けるため）。
 *
 * ビルドの失敗は警告にとどめ、他のコマンドと後続の処理は続ける。
 */
export async function buildCommands(repoRoot: string, homeDir: string): Promise<void> {
  if (Deno.build.os === "windows") {
    log.info("Windows では command のビルドを既定でスキップします");
    return;
  }

  const commandDir = join(repoRoot, "command");
  const binDir = join(homeDir, ".local", "bin");
  await ensureDir(binDir);

  let entries: Deno.DirEntry[];
  try {
    entries = [...Deno.readDirSync(commandDir)];
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return;
    throw err;
  }

  const cargo = await cargoVersion();
  const failed: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const dir = join(commandDir, entry.name);

    const cargoToml = await readTextOrUndefined(join(dir, "Cargo.toml"));
    if (cargoToml === undefined) continue;

    if (!(await buildCargoCommand(entry.name, dir, cargoToml, binDir, cargo))) {
      failed.push(entry.name);
    }
  }

  if (failed.length > 0) {
    log.warning(`⚠️ ビルドできなかった自前コマンド: ${failed.join(", ")}`);
  }
}
