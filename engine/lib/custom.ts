import { join } from "@std/path";
import { $ } from "@david/dax";
import { readTextOr } from "./fs.ts";
import { log } from "./logger.ts";
import {
  type CustomApp,
  type InstallMethod,
  parseCustomApps,
  selectInstallMethod,
} from "./custom-spec.ts";
import { detectDistro, type PackageManager } from "./linux/distro.ts";
import { installArgs } from "./linux/package-manager.ts";
import { isNativeCommand } from "./linux/wsl.ts";
import { installReaper } from "./linux/custom/reaper.ts";
import { installDrumGizmo } from "./macos/custom/drumgizmo.ts";

// 宣言では書けない手順を持つアプリの installer。名前 → 実装で引く。
// 宣言（app/<os>/custom.toml）に install を書かなければ、ここが使われる。
const BUILTIN: Record<string, () => Promise<void>> = {
  reaper: installReaper, // 配布ページの解析と日本語パック・フォント差し替えが要る（Linux）
  drumgizmo: installDrumGizmo, // 配布物の取得と展開先の組み立てが要る（macOS）
};

function existsSync(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/**
 * 宣言されたコマンド／パスから導入済みかを判定する。
 *
 * コマンドは解決したパスまで見る。WSL は interop で Windows 側の実行ファイルも PATH に載せるため、
 * それを Linux 側の導入と取り違えないようにする。
 */
async function isInstalled(app: CustomApp): Promise<boolean> {
  for (const name of app.commands) {
    const path = (await $`command -v ${name}`.noThrow().text()).trim();
    if (isNativeCommand(path)) return true;
  }
  return app.paths.some(existsSync);
}

/** apt がそのパッケージのインストール候補を持っているか（公式リポジトリ・登録済み PPA のいずれでも真）。 */
async function aptHasCandidate(pkg: string): Promise<boolean> {
  const policy = await $`apt-cache policy ${pkg}`.noThrow().text();
  const candidate = policy.match(/Candidate:\s*(\S+)/)?.[1];
  return candidate !== undefined && candidate !== "(none)";
}

/** distro の package manager で入れる。ppa 付きなら、候補が無いときだけ先に PPA を足す。 */
async function installByPackage(method: InstallMethod, pm: PackageManager): Promise<void> {
  const pkg = method.package!;
  if (method.ppa && pm === "apt" && !(await aptHasCandidate(pkg))) {
    log.info(`公式リポジトリに候補が無いため PPA を追加します: ${method.ppa}`);
    await $`sudo add-apt-repository -y ${method.ppa}`;
    await $`sudo apt update`;
  }
  await $`sudo ${installArgs(pm, [pkg])}`;
}

/** tarball を取得して展開先に置く（/opt などへの配置は sudo が要る）。 */
async function installByTarball(method: InstallMethod): Promise<void> {
  const dest = method.dest ?? "/opt";
  const archive = await Deno.makeTempFile({ suffix: ".tar.gz" });
  try {
    await $`curl -fsSL -o ${archive} ${method.tarball!}`;
    await $`sudo tar -xzf ${archive} -C ${dest}`;
  } finally {
    await Deno.remove(archive);
  }
}

/** 宣言された方法で導入する。 */
async function runMethod(app: CustomApp, method: InstallMethod): Promise<void> {
  if (method.package) {
    const pm = detectDistro(existsSync)?.packageManager;
    if (!pm) {
      log.warning(`⚠️ ${app.name}: distro を判定できないため package 経由の導入をスキップします`);
      return;
    }
    await installByPackage(method, pm);
    return;
  }
  if (method.script) {
    await $`sh -c ${`curl -fsSL ${method.script} | sh`}`;
    return;
  }
  if (method.tarball) {
    await installByTarball(method);
    return;
  }
  log.warning(`⚠️ ${app.name}: 導入方法が宣言されていません`);
}

/**
 * 宣言 1 件を導入する。`install` があれば宣言どおりに、無ければ engine の installer に任せる。
 * どちらも冪等（導入済みなら何もしない）。
 */
async function installApp(app: CustomApp, distro: string | undefined): Promise<void> {
  if (Object.keys(app.install).length === 0) {
    const builtin = BUILTIN[app.name];
    if (!builtin) {
      log.warning(`⚠️ ${app.name}: 導入方法の宣言も engine の installer もありません`);
      return;
    }
    log.info(`🔧 custom: ${app.name} を導入します...`);
    await builtin();
    return;
  }

  if (await isInstalled(app)) {
    log.success(`✅ ${app.name} は既にインストールされています`);
    return;
  }

  const method = selectInstallMethod(app, distro);
  if (!method) {
    log.info(`${app.name}: この環境向けの導入方法が宣言されていないためスキップします`);
    return;
  }

  log.info(`🔧 custom: ${app.name} を導入します...`);
  await runMethod(app, method);
  log.success(`✅ ${app.name} を導入しました`);
}

/**
 * 各 layer の `app/<os>/<manifest>` に宣言された custom アプリを合成順に導入する。
 *
 * manifest は環境の層に対応する: `custom.toml` は常に、`custom-gui.toml` はデスクトップ環境でだけ。
 * overlay も同じ宣言を持てる（engine のコードを持たない overlay でも、宣言で書ける物は足せる）。
 */
export async function runCustomInstallers(
  roots: string[],
  os: string,
  manifest: string,
): Promise<void> {
  const distro = os === "linux" ? detectDistro(existsSync)?.name : os;

  for (const root of roots) {
    const apps = parseCustomApps(await readTextOr(join(root, "app", os, manifest), ""));
    for (const app of apps) {
      await installApp(app, distro);
    }
  }
}
