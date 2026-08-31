import { join } from "@std/path";
import { log } from "./logger.ts";

/** 旧名 → 現在の名前。名前が変わった manifest を、読まれないまま放置しないために持つ。 */
const RENAMED: Array<{ old: string; now: string }> = [
  { old: "app/linux/gui", now: "app/linux/desktop" },
  { old: "app/linux/custom", now: "app/linux/custom.toml" },
  { old: "app/linux/custom-gui", now: "app/linux/custom-desktop.toml" },
  { old: "app/macos/custom", now: "app/macos/custom.toml" },
];

/** その layer に残っている旧名の manifest を返す。 */
export function renamedManifests(
  root: string,
  exists: (path: string) => boolean,
): Array<{ old: string; now: string }> {
  return RENAMED.filter((entry) => exists(join(root, ...entry.old.split("/"))));
}

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
 * 旧名の manifest が残っている layer を警告する。
 *
 * 名前が変わった manifest は黙って読まれなくなる。core は追従できるが overlay は別リポなので、
 * 気づかないまま宣言が効かなくなるのを防ぐ。
 */
export function warnRenamedManifests(roots: string[]): void {
  for (const root of roots) {
    for (const { old, now } of renamedManifests(root, existsSync)) {
      log.warning(`⚠️ ${join(root, old)} は読まれません（${now} に名前が変わりました）`);
    }
  }
}
