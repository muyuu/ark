import { dirname, join } from "@std/path";
import { ensureDir } from "@std/fs";
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

/**
 * git URL から ghq のローカルパス（`<ghqRoot>/<host>/<owner>/<repo>`）を組み立てる。
 * `git@host:owner/repo(.git)` と `https://host/owner/repo(.git)` を解釈する。解釈できなければ undefined。
 */
export function ghqPath(ghqRoot: string, url: string): string | undefined {
  let m = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (!m) m = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (!m) return undefined;
  const [, host, path] = m;
  return join(ghqRoot, host, ...path.split("/"));
}

/**
 * overlay の指定を git URL に正規化する。`git@…` / `https://…` 等はそのまま、`owner/repo`
 * の GitHub ショートハンドは SSH URL（`git@github.com:owner/repo.git`）に展開する。
 */
export function normalizeRepoUrl(spec: string): string {
  if (/^(git@|ssh:\/\/|https?:\/\/)/.test(spec)) return spec;
  if (/^[^/\s]+\/[^/\s]+$/.test(spec)) return `git@github.com:${spec.replace(/\.git$/, "")}.git`;
  return spec;
}

/** git URL から overlay 名を導く（リポジトリ名。末尾の `.git`・スラッシュは除く）。 */
export function nameFromUrl(url: string): string {
  const trimmed = url.replace(/\/+$/, "").replace(/\.git$/, "");
  return trimmed.split(/[/:]/).pop() ?? url;
}

/**
 * overlay を overlays.toml に登録する（無ければ作成）。同名・同 URL が既にあれば何もしない。
 * 追記したら true、既存なら false を返す。
 */
export async function addOverlay(homeDir: string, name: string, url: string): Promise<boolean> {
  const existing = await loadOverlays(homeDir);
  if (existing.some((o) => o.name === name || o.url === url)) return false;

  const path = overlaysConfigPath(homeDir);
  await ensureDir(dirname(path));
  let current = "";
  try {
    current = await Deno.readTextFile(path);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  const sep = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  await Deno.writeTextFile(
    path,
    `${current}${sep}\n[[overlay]]\nname = "${name}"\nurl  = "${url}"\n`,
  );
  return true;
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

/** ghq の管理ルートを解決する（ghq があれば `ghq root`、無ければ git config の ghq.root、既定 ~/ghq）。 */
export async function resolveGhqRoot(homeDir: string): Promise<string> {
  if (await $.commandExists("ghq")) {
    const r = (await $`ghq root`.noThrow().text()).trim();
    if (r) return r;
  }
  const cfg = (await $`git config --get ghq.root`.noThrow().text()).trim();
  if (cfg) return cfg.startsWith("~") ? join(homeDir, cfg.slice(1)) : cfg;
  return join(homeDir, "ghq");
}

/**
 * 登録された overlay を ghq ツリーへ取得する（ghq があれば `ghq get -u`、無ければ git で clone/pull）。
 * private repo の取得には GitHub 認証が要る（bootstrap が確立する）。取得した各 overlay の
 * ローカルパスを登録順で返す。
 */
export async function syncOverlays(homeDir: string): Promise<string[]> {
  const root = await resolveGhqRoot(homeDir);
  const hasGhq = await $.commandExists("ghq");
  const roots: string[] = [];

  for (const o of await loadOverlays(homeDir)) {
    const dir = ghqPath(root, o.url);
    if (!dir) {
      log.warning(`overlay ${o.name}: URL を解釈できません: ${o.url}`);
      continue;
    }
    log.info(`⬇️ overlay ${o.name} を取得します: ${o.url}`);
    if (hasGhq) {
      await $`ghq get -u ${o.url}`;
    } else if (await $.path(join(dir, ".git")).exists()) {
      await $`git -C ${dir} pull --ff-only`.noThrow();
    } else {
      await $`git clone ${o.url} ${dir}`;
    }
    roots.push(dir);
  }
  return roots;
}
