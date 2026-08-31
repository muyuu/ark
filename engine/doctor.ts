import { dirname, fromFileUrl, join } from "@std/path";
import { $ } from "@david/dax";
import { commandBinNames } from "./lib/command.ts";
import { isDesktop, isDev, isServer } from "./lib/desktop.ts";
import {
  diagnoseCommands,
  diagnoseKeys,
  diagnoseLinks,
  diagnoseOverlays,
  diagnosePackages,
  type Finding,
  formatFindings,
  parseAptPolicy,
} from "./lib/doctor.ts";
import { layers, readManifest } from "./lib/layer.ts";
import { plannedLinks } from "./lib/link.ts";
import { detectDistro } from "./lib/linux/distro.ts";
import { mapPackageNames, parsePackageMap, parseSystemPackages } from "./lib/linux/packages.ts";
import { ghqPath, loadOverlays, resolveGhqRoot } from "./lib/overlay.ts";
import { collectKeyDecls } from "./lib/ssh-decls.ts";
import { readTextOr } from "./lib/fs.ts";
import { resolveKeys } from "./lib/ssh.ts";
import { log } from "./lib/logger.ts";

/**
 * 宣言と実機のズレを見つける。`ark audit` の裏返しで、**宣言にあるのに実機で効いていない物**を挙げる。
 *
 * 何も直さない。新しいマシンや久しぶりのマシンで「何かおかしい」と思ったときに最初に叩くもの。
 */

function existsSync(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return false;
    throw err;
  }
}

/** symlink の指す先。symlink でなければ undefined。 */
function readLink(target: string): string | undefined {
  try {
    if (!Deno.lstatSync(target).isSymlink) return undefined;
    return Deno.readLinkSync(target);
  } catch {
    return undefined;
  }
}

/** この環境で適用される Linux の manifest 名（install と同じ判定）。 */
function activeManifests(): string[] {
  const names = ["packages"];
  if (isServer()) names.push("server");
  if (isDev()) names.push("dev");
  if (isDesktop()) names.push("desktop");
  return names;
}

/**
 * 宣言された論理パッケージ名を distro の実名へ解決し、apt が候補を持つか見る。
 * Debian 系のみ。他の distro は同等の一括問い合わせが無いので飛ばす。
 */
async function checkPackages(repoRoot: string, home: string): Promise<Finding[]> {
  if (Deno.build.os !== "linux") return [];
  const distro = detectDistro(existsSync);
  if (distro?.name !== "debian") return [];

  const found = await layers(repoRoot, home);
  const declared: string[] = [];
  for (const layer of found) {
    const map = parsePackageMap(await readManifest(layer, "app/linux/distro/debian.map"));
    for (const manifest of activeManifests()) {
      const content = await readManifest(layer, `app/linux/${manifest}`);
      declared.push(...parseSystemPackages(content).flatMap((n) => mapPackageNames(map, n)));
    }
  }
  if (declared.length === 0) return [];

  // apt-cache の出力はロケールで変わる（日本語環境では「候補:」になる）。C ロケールに固定する。
  const policy = await $`apt-cache policy ${declared}`.env("LC_ALL", "C").noThrow().text();
  return diagnosePackages(declared, parseAptPolicy(policy));
}

if (import.meta.main) {
  const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..");
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    log.error("HOME / USERPROFILE が未設定です");
    Deno.exit(1);
  }

  const findings: Finding[] = [];

  findings.push(...diagnoseLinks(await plannedLinks(repoRoot, home), readLink));

  const ghqRoot = await resolveGhqRoot(home);
  findings.push(...diagnoseOverlays(
    (await loadOverlays(home)).map((o) => ({ name: o.name, dir: ghqPath(ghqRoot, o.url) })),
    existsSync,
  ));

  if (Deno.build.os !== "windows") {
    const binDir = join(home, ".local", "bin");
    findings.push(
      ...diagnoseCommands(await commandBinNames(repoRoot), (n) => existsSync(join(binDir, n))),
    );
  }

  const keys = resolveKeys(home, await collectKeyDecls(repoRoot, home));
  const sshConfig = await readTextOr(join(home, ".ssh", "config"), "");
  findings.push(...diagnoseKeys(keys, existsSync, sshConfig));

  findings.push(...await checkPackages(repoRoot, home));

  if (findings.length === 0) {
    log.success("✅ 宣言と実機のズレは見つかりませんでした");
  } else {
    log.warning(`⚠️ ${findings.length} 件のズレが見つかりました:`);
    for (const line of formatFindings(findings)) log.warning(line);
    Deno.exit(1);
  }
}
