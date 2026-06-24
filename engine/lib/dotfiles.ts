import { dirname, join } from "@std/path";
import { ensureDir } from "@std/fs";
import { log, Logger } from "./logger.ts";

/** config 内のソースを $HOME 配下のどこへ symlink するかの 1 対応。 */
export interface LinkPlan {
  source: string;
  target: string;
}

/** ディレクトリ直下のエントリ名を返す（再帰しない）。テスト時に差し替える。 */
export type ListDir = (dir: string) => string[];

// OS が生成するメタファイル。トップレベルの dotfile からは除外する。
const EXCLUDES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

// 自身ではなく中身（子）を個別リンクするマージ対象ディレクトリ。
// $HOME 側を実ディレクトリに保つことで、core と overlay が同じディレクトリへ各自のファイルを足せる。
// `.config` / `.claude` は ark 管理外のランタイム状態（cache・session 等）とも混ざるため必須。
const LINK_CHILDREN = new Set([".config", ".claude", ".zsh.d"]);

/**
 * configDir から homeDir への symlink 計画を算出する（副作用なし）。
 *
 * - トップレベルの隠しファイルは $HOME 直下へリンク（除外リストを除く）
 * - マージ対象ディレクトリ（`.config` / `.claude` / `.zsh.d`）は自身ではなく中身を
 *   $HOME/<name>/<child> へ個別リンク
 */
export function planLinks(configDir: string, homeDir: string, listDir: ListDir): LinkPlan[] {
  const plans: LinkPlan[] = [];

  for (const name of listDir(configDir)) {
    if (!name.startsWith(".")) continue;

    if (LINK_CHILDREN.has(name)) {
      const srcDir = join(configDir, name);
      for (const child of listDir(srcDir)) {
        plans.push({ source: join(srcDir, child), target: join(homeDir, name, child) });
      }
      continue;
    }

    if (EXCLUDES.has(name)) continue;

    plans.push({ source: join(configDir, name), target: join(homeDir, name) });
  }

  return plans;
}

function listDirReal(dir: string): string[] {
  return [...Deno.readDirSync(dir)].map((entry) => entry.name);
}

/**
 * 既存の target を片付けてから source への symlink を張る。
 *
 * 既存が symlink なら作り直すだけ（symlink は再現可能なので退避不要）。
 * 既存が実ファイル/ディレクトリなら、ユーザー自身の設定を破壊しないよう
 * `<target>.bak.<epoch ms>` へ退避してから symlink を張る。
 */
async function forceSymlink(source: string, target: string): Promise<void> {
  let info: Deno.FileInfo | undefined;
  try {
    info = await Deno.lstat(target);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }

  if (info?.isSymlink) {
    await Deno.remove(target);
  } else if (info) {
    await Deno.rename(target, `${target}.bak.${Date.now()}`);
  }

  // Windows はディレクトリ symlink に type 指定が要る（Unix では無視される）。
  const type = (await Deno.stat(source)).isDirectory ? "dir" : "file";
  await Deno.symlink(source, target, { type });
}

/**
 * リンク先の親ディレクトリを実ディレクトリとして用意する。
 *
 * マージ対象ディレクトリ（.zsh.d 等）は子を個別リンクするため、$HOME 側が**実ディレクトリ**である必要が
 * ある。過去にディレクトリ単位の symlink（例: ~/.zsh.d → config/.zsh.d）が張られていると、子の
 * lstat が symlink 越しにソース実体を指し、退避処理がソースを壊す。symlink なら剥がして実体化する。
 */
async function ensureRealDir(dir: string): Promise<void> {
  try {
    if ((await Deno.lstat(dir)).isSymlink) await Deno.remove(dir);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
  await ensureDir(dir);
}

/**
 * configDir 内の設定を homeDir 配下へ symlink で展開する。
 * 既存の symlink は張り直すため再実行しても冪等。既存が実ファイル/ディレクトリの場合は
 * 破壊せず退避する（forceSymlink 参照）。算出したリンク計画を返す。
 *
 * filter を渡すと、その計画だけにリンク対象を絞れる（native Windows のように、実際に読まれる
 * 設定だけを展開したいときに使う）。
 */
export async function linkDotfiles(
  configDir: string,
  homeDir: string,
  logger: Logger = log,
  filter: (plan: LinkPlan) => boolean = () => true,
): Promise<LinkPlan[]> {
  const plans = planLinks(configDir, homeDir, listDirReal).filter(filter);

  for (const { source, target } of plans) {
    await ensureRealDir(dirname(target));
    try {
      await forceSymlink(source, target);
      logger.info(`→ リンク: ${target}`);
    } catch (err) {
      // Windows は symlink 作成に特権が要る（開発者モード or 管理者）。未付与なら中断せず警告して続ける。
      if (Deno.build.os === "windows") {
        logger.warning(`⚠️ symlink を作成できませんでした（開発者モード/管理者が必要）: ${target}`);
        continue;
      }
      throw err;
    }
  }

  return plans;
}
