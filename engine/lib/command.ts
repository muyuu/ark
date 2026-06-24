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

/**
 * command/ 配下の自前コマンドをビルドして `~/.local/bin` に配置する。
 *
 * サブディレクトリを種類で判定して個別にビルドする（現状 Cargo.toml = Rust の `cargo build --release`）。
 * 生成物は `~/.local/bin/<name>` に symlink する（再ビルドで自動反映される）。Cargo プロジェクトでない
 * ディレクトリはスキップする。Windows は既定でビルドをスキップする（rust(MSVC) のリンカ前提を避けるため）。
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

  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const dir = join(commandDir, entry.name);

    const cargoToml = await readTextOrUndefined(join(dir, "Cargo.toml"));
    if (cargoToml === undefined) continue;

    const bin = cargoBinName(cargoToml) ?? entry.name;
    log.info(`🔨 command/${entry.name} をビルドします...`);
    await $`mise exec -- cargo build --release`.cwd(dir);

    const built = join(dir, "target", "release", bin);
    const link = join(binDir, bin);
    await forceSymlink(built, link);
    log.success(`✅ ${bin} → ${link}`);
  }
}
