import { join } from "@std/path";
import { parse as parseToml } from "@std/toml";
import { $ } from "@david/dax";
import { log } from "./logger.ts";

/** overlay の登録エントリ（machine-local の overlays.toml に書く）。 */
export interface Overlay {
  name: string;
  url: string;
}

/** overlays.toml を解釈する。`[[overlay]]` 配列から name/url の揃ったものだけを順序を保って返す。 */
export function parseOverlays(toml: string): Overlay[] {
  const parsed = parseToml(toml) as { overlay?: Array<{ name?: unknown; url?: unknown }> };
  const list = parsed.overlay ?? [];
  return list
    .filter((o): o is Overlay => typeof o.name === "string" && typeof o.url === "string");
}

/** machine-local の overlay 登録ファイルのパス。 */
export function overlaysConfigPath(homeDir: string): string {
  return join(homeDir, ".config", "ark", "overlays.toml");
}

/** overlay の clone 先ディレクトリ。 */
export function overlayDir(homeDir: string, name: string): string {
  return join(homeDir, ".config", "ark", "overlays", name);
}

/** 登録された overlay を読み込む。登録ファイルが無ければ空配列。 */
export async function loadOverlays(homeDir: string): Promise<Overlay[]> {
  try {
    return parseOverlays(await Deno.readTextFile(overlaysConfigPath(homeDir)));
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return [];
    throw err;
  }
}

/**
 * 登録された overlay を取得する（未取得なら clone、取得済みなら pull）。private repo の clone には
 * GitHub 認証が要る（bootstrap が確立する）。取得した各 overlay の clone 先を登録順で返す。
 */
export async function syncOverlays(homeDir: string): Promise<string[]> {
  const roots: string[] = [];
  for (const o of await loadOverlays(homeDir)) {
    const dir = overlayDir(homeDir, o.name);
    if (await $.path(join(dir, ".git")).exists()) {
      log.info(`⬇️ overlay ${o.name} を更新します...`);
      await $`git -C ${dir} pull --ff-only`.noThrow();
    } else {
      log.info(`📦 overlay ${o.name} を取得します: ${o.url}`);
      await $`git clone ${o.url} ${dir}`;
    }
    roots.push(dir);
  }
  return roots;
}

/**
 * core と取得済み overlay の layer ルートを合成順（core → 登録順）で返す。
 * install / link はこの順で各層を処理し、後の層（overlay）が衝突時に勝つ。取得は行わない。
 */
export async function layerRoots(repoRoot: string, homeDir: string): Promise<string[]> {
  const roots = [repoRoot];
  for (const o of await loadOverlays(homeDir)) {
    const dir = overlayDir(homeDir, o.name);
    if (await $.path(dir).exists()) roots.push(dir);
  }
  return roots;
}
