import { join } from "@std/path";
import { $ } from "@david/dax";
import { readTextOr } from "./fs.ts";
import { ghqPath, loadOverlays, resolveGhqRoot } from "./overlay.ts";

/**
 * 宣言を重ねる単位。core が最初で、以降は overlay の登録順。後の layer が衝突時に勝つ。
 *
 * どの処理も「layer を順に見る」形になるので、パスの組み立てと読み出しはここに集約する。
 */
export interface Layer {
  /** 表示用の名前（core は `core`、overlay は登録名）。ログで層を指すのに使う。 */
  name: string;
  /** この layer のルートディレクトリ。 */
  root: string;
}

/** layer 内の相対パス（`/` 区切り）を絶対パスにする。 */
export function manifestPath(layer: Layer, relPath: string): string {
  return join(layer.root, ...relPath.split("/"));
}

/** layer の manifest を読む。持たない layer もあるので、無ければ空文字。 */
export function readManifest(layer: Layer, relPath: string): Promise<string> {
  return readTextOr(manifestPath(layer, relPath), "");
}

/** 各 layer の manifest を合成順に読み、パースした結果を連結する。 */
export async function collect<T>(
  layers: Layer[],
  relPath: string,
  parse: (text: string) => T[],
): Promise<T[]> {
  const items: T[] = [];
  for (const layer of layers) {
    items.push(...parse(await readManifest(layer, relPath)));
  }
  return items;
}

/**
 * 実在する manifest の絶対パスを合成順に返す。
 * ファイルそのものを外部コマンドへ渡す場合（`brew bundle --file`）に使う。
 */
export async function existingManifestPaths(
  layers: Layer[],
  relPath: string,
): Promise<string[]> {
  const paths: string[] = [];
  for (const layer of layers) {
    const path = manifestPath(layer, relPath);
    if (await $.path(path).exists()) paths.push(path);
  }
  return paths;
}

/**
 * core と取得済み overlay の layer を合成順で返す。overlay は ghq ツリー上のローカルパスを指す。
 * 取得は行わない（未取得の overlay は含まれない）。
 */
export async function layers(repoRoot: string, homeDir: string): Promise<Layer[]> {
  const ghqRoot = await resolveGhqRoot(homeDir);
  const found: Layer[] = [{ name: "core", root: repoRoot }];

  for (const overlay of await loadOverlays(homeDir)) {
    const dir = ghqPath(ghqRoot, overlay.url);
    if (dir && await $.path(dir).exists()) found.push({ name: overlay.name, root: dir });
  }
  return found;
}
