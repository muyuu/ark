import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { $ } from "@david/dax";
import { log } from "../logger.ts";

const DOWNLOAD_PAGE = "https://www.reaper.fm/download.php";

// Phroneris 氏の日本語化パッチ。ライセンス未明記（全権利留保）かつ作者が公式配布先からの
// 取得を求めているため同梱せず取得する。GitHub が落ちても入るよう公式ミラー（REAPER Stash）を続ける。
const JPN_PATCH_URLS = [
  "https://github.com/Phroneris/ReaperJPN-Phroneris/releases/download/v6.19.001/JPN_Phroneris.zip",
  "http://stash.reaper.fm/v/27131/JPN_Phroneris.zip",
];

// Linux 版 REAPER(SWELL) のネイティブ UI は libSwell.colortheme の default_font_face を
// fontconfig で 1 フェイスだけ解決して描画する（グリフ単位フォールバック無し）。既定の
// Liberation Sans は日本語グリフを持たず日本語パックが豆腐になるため、CJK フォントに差し替える。
const COLORTHEME_FILE = "libSwell.colortheme";
const JA_FONT_FACE = "Noto Sans CJK JP";

/** uname -m の値を REAPER 配布物の arch 文字列に変換する。未対応なら空文字。 */
export function detectArchSuffix(machine: string): string {
  switch (machine) {
    case "x86_64":
      return "linux_x86_64";
    case "aarch64":
    case "arm64":
      return "linux_aarch64";
    case "i686":
    case "i386":
      return "linux_i686";
    case "armv7l":
      return "linux_armv7l";
    default:
      return "";
  }
}

/** ダウンロードページの HTML から arch に一致するアーカイブ相対パスを取り出す。 */
export function parseLatestRelativePath(html: string, archSuffix: string): string | undefined {
  const re = new RegExp(`files/[0-9]+\\.x/reaper[0-9]+_${archSuffix}\\.tar\\.xz`);
  return html.match(re)?.[0];
}

/** 相対パス（reaperNNN_linux_...）からバージョン桁を取り出す。 */
export function latestVersionDigits(relativePath: string): string {
  return relativePath.match(/\/reaper([0-9]+)_linux_/)?.[1] ?? "";
}

/** `reaper --version` の出力から x.y を取り、ドットを除いた桁を返す。 */
export function installedVersionDigits(versionOutput: string): string {
  return (versionOutput.match(/[0-9]+\.[0-9]+/)?.[0] ?? "").replaceAll(".", "");
}

/**
 * libSwell.colortheme の default_font_face を指定フェイスに差し替えた内容を返す。
 * 行が無ければ先頭に追加する。元から目的のフェイスなら content をそのまま返す。
 */
export function patchDefaultFontFace(content: string, face: string): string {
  const line = `default_font_face ${face}`;
  if (/^default_font_face .*$/m.test(content)) {
    return content.replace(/^default_font_face .*$/m, line);
  }
  return `${line}\n${content}`;
}

async function archSuffixOrExit(): Promise<string> {
  const machine = (await $`uname -m`.text()).trim();
  const suffix = detectArchSuffix(machine);
  if (!suffix) {
    log.error(`REAPER インストーラ未対応のアーキテクチャ: ${machine}`);
    Deno.exit(1);
  }
  return suffix;
}

async function fetchLatestRelativePath(archSuffix: string): Promise<string | undefined> {
  const html = await $`curl -fsSL ${DOWNLOAD_PAGE}`.noThrow().text();
  return parseLatestRelativePath(html, archSuffix);
}

async function fetchInstalledVersion(): Promise<string> {
  if (!(await $.commandExists("reaper"))) return "";
  return installedVersionDigits(await $`reaper --version`.noThrow().text());
}

async function findFirst(args: string[]): Promise<string | undefined> {
  const out = (await $`find ${args}`.noThrow().text()).trim();
  return out.split("\n")[0] || undefined;
}

/** インストール済み REAPER が最新かどうかを返す。未インストールや更新ありは false。 */
export async function checkReaper(): Promise<boolean> {
  const archSuffix = await archSuffixOrExit();
  const relativePath = await fetchLatestRelativePath(archSuffix);
  if (!relativePath) {
    log.error("REAPER の最新リリース情報の取得に失敗しました");
    Deno.exit(1);
  }

  const latest = latestVersionDigits(relativePath);
  const installed = await fetchInstalledVersion();
  if (!installed) {
    log.info("REAPER: 未インストール");
    return false;
  }
  if (installed === latest) {
    log.success(`REAPER: 最新です (installed=${installed}, latest=${latest})`);
    return true;
  }
  log.info(`REAPER: 更新があります (installed=${installed}, latest=${latest})`);
  return false;
}

/** ネイティブ UI フォントを CJK フェイスに差し替え、日本語パックの豆腐を防ぐ。 */
async function patchColortheme(reaperDir: string): Promise<void> {
  const file = join(reaperDir, COLORTHEME_FILE);
  if (!(await $.path(file).exists())) {
    log.warning(`${COLORTHEME_FILE} が見つかりません。UI フォント差し替えをスキップします`);
    return;
  }
  const patched = patchDefaultFontFace(await Deno.readTextFile(file), JA_FONT_FACE);
  await Deno.writeTextFile(file, patched);
  log.info(`UI フォントを ${JA_FONT_FACE} に設定しました: ${COLORTHEME_FILE}`);
}

async function applyJapanesePatch(reaperDir: string, tmpdir: string): Promise<void> {
  const reaperExe = join(reaperDir, "reaper");
  if (!(await $.path(reaperExe).exists())) {
    log.warning("REAPER 実行ファイルが見つかりません。日本語化をスキップします");
    return;
  }

  log.info(`日本語パッチを適用します: ${reaperDir}`);
  const patchZip = join(tmpdir, "jpn_patch.zip");
  let downloaded = false;
  for (const url of JPN_PATCH_URLS) {
    if ((await $`curl -fsSL ${url} -o ${patchZip}`.noThrow()).code === 0) {
      downloaded = true;
      break;
    }
    log.warning(`日本語パッチの取得に失敗: ${url}`);
  }
  if (!downloaded) {
    log.warning("日本語パッチを取得できませんでした。スキップします");
    return;
  }

  const extractDir = join(tmpdir, "jpn_patch");
  if ((await $`unzip -q ${patchZip} -d ${extractDir}`.noThrow()).code !== 0) {
    log.warning("日本語パッチの展開に失敗しました。スキップします");
    return;
  }

  const langpack = await findFirst([extractDir, "-name", "*.ReaperLangPack"]);
  if (!langpack) {
    log.warning("パッチ内に .ReaperLangPack が見つかりません。スキップします");
    return;
  }

  const dest = join(reaperDir, "Resources/Localization");
  await ensureDir(dest);
  await Deno.copyFile(langpack, join(dest, langpack.split("/").pop()!));
  log.info(`言語パックを配置しました: ${dest}`);

  await patchColortheme(reaperDir);

  // 言語パックを REAPER に取り込む。Xvfb があればヘッドレスで、無ければ起動して手動取り込みを促す。
  if (await $.commandExists("xvfb-run")) {
    await $`timeout 10 xvfb-run -a ${reaperExe} ${langpack}`.noThrow();
  } else {
    log.info("REAPER を起動します。言語パックをドラッグ&ドロップで取り込んでください（30 秒待機）");
    const child = new Deno.Command(reaperExe, { stdout: "null", stderr: "null" }).spawn();
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    try {
      child.kill();
    } catch {
      // 既に終了済みなら無視
    }
  }
  log.success("日本語化のセットアップが完了しました。REAPER を再起動すると反映されます");
}

/** REAPER をダウンロードして /opt（不可なら ~/.local/opt）へインストールし、日本語化まで行う。 */
export async function installReaper(): Promise<void> {
  if (await $.commandExists("reaper")) {
    log.success("REAPER は既にインストールされています");
    return;
  }

  const archSuffix = await archSuffixOrExit();
  const relativePath = await fetchLatestRelativePath(archSuffix);
  if (!relativePath) {
    log.error(`${archSuffix} 向け REAPER アーカイブの URL を取得できませんでした`);
    Deno.exit(1);
  }

  const tmpdir = await Deno.makeTempDir();
  try {
    const archivePath = join(tmpdir, "reaper.tar.xz");
    log.info(`Downloading REAPER: https://www.reaper.fm/${relativePath}`);
    await $`curl -fsSL ${`https://www.reaper.fm/${relativePath}`} -o ${archivePath}`;
    await $`tar -xJf ${archivePath} -C ${tmpdir}`;

    const installer = await findFirst([
      tmpdir,
      "-maxdepth",
      "2",
      "-type",
      "f",
      "-name",
      "install-reaper.sh",
    ]);
    if (!installer) {
      log.error("アーカイブ内に install-reaper.sh が見つかりませんでした");
      Deno.exit(1);
    }

    let installDir = "/opt";
    if ((await $`test -w /opt`.noThrow()).code !== 0) {
      log.warning("/opt が書き込み不可のため ~/.local/opt を使用します");
      installDir = join(Deno.env.get("HOME") ?? "", ".local/opt");
      await ensureDir(installDir);
    }

    log.info(`REAPER をインストールします: ${installDir}`);
    await $`${installer} --install ${installDir} --integrate-desktop --usr-local-bin-symlink`
      .noThrow();

    if (installDir.endsWith(".local/opt")) {
      const binDir = join(Deno.env.get("HOME") ?? "", ".local/bin");
      await ensureDir(binDir);
      const reaperBin = join(installDir, "REAPER/reaper");
      if (await $.path(reaperBin).exists()) {
        await $`ln -sf ${reaperBin} ${join(binDir, "reaper")}`.noThrow();
        log.info(
          `${
            join(binDir, "reaper")
          } に symlink を作成しました（$PATH に ${binDir} を含めてください）`,
        );
      }
    }

    await applyJapanesePatch(join(installDir, "REAPER"), tmpdir);
  } finally {
    await Deno.remove(tmpdir, { recursive: true }).catch(() => {});
  }
}

/** 最新でなければ再インストールで更新する。 */
export async function updateReaper(): Promise<void> {
  if (await checkReaper()) {
    log.success("REAPER は既に最新です");
    return;
  }
  log.info("REAPER を更新します...");
  await installReaper();
}

/** /opt または ~/.local/opt の uninstall スクリプトで REAPER をアンインストールする。 */
export async function uninstallReaper(): Promise<void> {
  const candidates = [
    "/opt/REAPER/uninstall-reaper.sh",
    join(Deno.env.get("HOME") ?? "", ".local/opt/REAPER/uninstall-reaper.sh"),
  ];

  for (const script of candidates) {
    if (await $.path(script).exists()) {
      log.info(`REAPER をアンインストールします: ${script}`);
      const r = await $`${script} --uninstall`.noThrow();
      if (r.code !== 0) await $`${script}`.noThrow();
      log.success("REAPER のアンインストールが完了しました");
      return;
    }
  }
  log.warning("REAPER の uninstall スクリプトが見つかりません。スキップします");
}

/** 既にインストール済みの REAPER に日本語化パッチを適用する。 */
export async function applyJapaneseToInstalled(): Promise<void> {
  if (!(await $.commandExists("reaper"))) {
    log.error("REAPER がインストールされていません");
    Deno.exit(1);
  }

  const realPath = (await $`readlink -f ${await $`command -v reaper`.text().then((s) => s.trim())}`
    .text()).trim();
  const reaperDir = realPath.slice(0, realPath.lastIndexOf("/"));

  const tmpdir = await Deno.makeTempDir();
  try {
    await applyJapanesePatch(reaperDir, tmpdir);
  } finally {
    await Deno.remove(tmpdir, { recursive: true }).catch(() => {});
  }
}
