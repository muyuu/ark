import { basename, join } from "@std/path";
import { ensureDir } from "@std/fs";
import { $ } from "@david/dax";
import { log } from "../logger.ts";

// DrumGizmo（OSS ドラム音源）の macOS 個別インストーラ。Homebrew / winget に無いため、reaper.ts と同型の
// detect / install / update をベンダー配布物（reaper.fm に相当する drumgizmo.org の releases）から行う。
//
// macOS でパッケージマネージャに無い DTM ツール（MOTU M2 ドライバ / ToneLib GFX 等）を src/lib/macos/ に
// 増やす際の雛形でもある。dtm profile 向けのツールなので、導入するかは呼び手（profile）が決める。

const RELEASES_INDEX = "https://www.drumgizmo.org/releases/";

/** プラグインの導入先（VST2）。配布物に含まれる .vst バンドルをここへ置く。 */
function vstDir(): string {
  return join(Deno.env.get("HOME") ?? "", "Library/Audio/Plug-Ins/VST");
}

/** ark が導入したバージョンを記録するマーカー。プラグインはバージョンを自己申告しないため版管理に使う。 */
function versionMarker(): string {
  return join(vstDir(), ".drumgizmo-ark-version");
}

/** `a.b.c` 形式を数値セグメントごとに比較する。a<b で負、a>b で正、等しければ 0。 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Apache の releases 一覧 HTML から最新の drumgizmo バージョンを取り出す。無ければ空文字。 */
export function parseLatestVersion(listingHtml: string): string {
  const versions = [...listingHtml.matchAll(/drumgizmo-(\d+(?:\.\d+)+)\//g)].map((m) => m[1]);
  if (versions.length === 0) return "";
  return versions.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best));
}

/** バージョンから macOS 配布物（VST の tar.gz）の URL を組む。 */
export function osxAssetUrl(version: string): string {
  return `${RELEASES_INDEX}drumgizmo-${version}/drumgizmo-vst-osx-${version}.tar.gz`;
}

async function fetchLatestVersion(): Promise<string> {
  const html = await $`curl -fsSL ${RELEASES_INDEX}`.noThrow().text();
  return parseLatestVersion(html);
}

function installedVersion(): string {
  try {
    return Deno.readTextFileSync(versionMarker()).trim();
  } catch {
    return "";
  }
}

/** 最新バージョンを取得して配布物を導入し、バージョンマーカーを更新する。 */
async function fetchAndInstall(version: string): Promise<void> {
  const dest = vstDir();
  await ensureDir(dest);

  const tmpdir = await Deno.makeTempDir();
  try {
    const archive = join(tmpdir, "drumgizmo-osx.tar.gz");
    log.info(`Downloading DrumGizmo: ${osxAssetUrl(version)}`);
    if ((await $`curl -fsSL ${osxAssetUrl(version)} -o ${archive}`.noThrow()).code !== 0) {
      log.error("DrumGizmo の配布物のダウンロードに失敗しました");
      return;
    }
    await $`tar -xzf ${archive} -C ${tmpdir}`.noThrow();

    // 配布物に含まれる .vst バンドルを Plug-Ins/VST へ配置する。
    const found = (await $`find ${tmpdir} -maxdepth 3 -name *.vst`.noThrow().text())
      .trim().split("\n").filter((p) => p.length > 0);
    if (found.length === 0) {
      log.warning("配布物に .vst バンドルが見つかりませんでした");
      return;
    }
    for (const bundle of found) {
      await $`rm -rf ${join(dest, basename(bundle))}`.noThrow();
      await $`cp -R ${bundle} ${dest}/`.noThrow();
    }

    await Deno.writeTextFile(versionMarker(), version);
    log.success(`DrumGizmo ${version} を ${dest} に導入しました`);
  } finally {
    await Deno.remove(tmpdir, { recursive: true }).catch(() => {});
  }
}

/** インストール済み DrumGizmo が最新かどうかを返す。未導入や更新ありは false。 */
export async function checkDrumGizmo(): Promise<boolean> {
  const latest = await fetchLatestVersion();
  if (!latest) {
    log.error("DrumGizmo の最新リリース情報の取得に失敗しました");
    return false;
  }
  const installed = installedVersion();
  if (!installed) {
    log.info("DrumGizmo: 未インストール");
    return false;
  }
  if (compareVersions(installed, latest) >= 0) {
    log.success(`DrumGizmo: 最新です (installed=${installed}, latest=${latest})`);
    return true;
  }
  log.info(`DrumGizmo: 更新があります (installed=${installed}, latest=${latest})`);
  return false;
}

/** 未導入なら最新の DrumGizmo を導入する。導入済みならスキップ。 */
export async function installDrumGizmo(): Promise<void> {
  if (installedVersion()) {
    log.success("DrumGizmo は既にインストールされています");
    return;
  }
  const latest = await fetchLatestVersion();
  if (!latest) {
    log.error("DrumGizmo の最新リリース情報の取得に失敗しました");
    return;
  }
  await fetchAndInstall(latest);
}

/** 最新でなければ導入し直して更新する。 */
export async function updateDrumGizmo(): Promise<void> {
  if (await checkDrumGizmo()) {
    log.success("DrumGizmo は既に最新です");
    return;
  }
  const latest = await fetchLatestVersion();
  if (!latest) return;
  log.info("DrumGizmo を更新します...");
  await fetchAndInstall(latest);
}
