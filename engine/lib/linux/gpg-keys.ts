import { $ } from "@david/dax";
import { log } from "../logger.ts";
import { readTextOr } from "../fs.ts";

const KEY_PATH_PLACEHOLDER = "__KEY_PATH__";
const KEYRING_DIR = "/etc/apt/keyrings";
const SOURCES_DIR = "/etc/apt/sources.list.d";

/** gpg-keys.txt の 1 エントリ。GPG キーと対応する APT source 行。 */
export interface GpgKey {
  /** /etc/apt/keyrings と /etc/apt/sources.list.d で使うファイル名。 */
  name: string;
  /** GPG キーの取得元 URL。 */
  url: string;
  /** APT source 行。`__KEY_PATH__` プレースホルダを含む（[[substituteKeyPath]] で置換）。 */
  sourceLine: string;
}

/**
 * gpg-keys.txt を解釈する。各行は `<name> <url> "<source line>"`。
 * コメント行・空行は無視する。source 行は外側のクォートのみ除去し、内部のクォートは保持する。
 */
export function parseGpgKeys(content: string): GpgKey[] {
  const keys: GpgKey[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const match = line.match(/^(\S+)\s+(\S+)\s+(.*)$/);
    if (!match) continue;

    const [, name, url, rest] = match;
    let sourceLine = rest.trim();
    if (sourceLine.startsWith('"') && sourceLine.endsWith('"')) {
      sourceLine = sourceLine.slice(1, -1);
    }

    keys.push({ name, url, sourceLine });
  }

  return keys;
}

/** source 行内の `__KEY_PATH__` を実際の keyring パスに置換する。 */
export function substituteKeyPath(sourceLine: string, keyPath: string): string {
  return sourceLine.replaceAll(KEY_PATH_PLACEHOLDER, keyPath);
}

async function pathExists(path: string): Promise<boolean> {
  return await $.path(path).exists();
}

/**
 * gpg-keys.txt に基づき GPG キーと APT source を /etc/apt 配下に登録する（要 root 権限・Debian 系専用）。
 * キーが既にあれば再取得しない。1Password は公式キーがあればそれを優先する。最後に apt-get update を実行。
 * keysFile が無い場合は何もしない。
 */
export async function registerGpgKeys(keysFile: string): Promise<void> {
  const content = await readTextOr(keysFile, "");
  if (!content) return;

  await $`sudo mkdir -p ${KEYRING_DIR}`;

  for (const key of parseGpgKeys(content)) {
    log.info(`Processing [${key.name}]...`);
    let keyPath = `${KEYRING_DIR}/${key.name}.gpg`;

    // 1Password は公式キーが既にあればそれを使い、古い .list を消す
    if (key.name === "1password") {
      const officialKey = "/usr/share/keyrings/1password-archive-keyring.gpg";
      if (await pathExists(officialKey)) {
        keyPath = officialKey;
        const oldList = `${SOURCES_DIR}/1password.list`;
        if (await pathExists(oldList)) await $`sudo rm ${oldList}`;
      }
    }

    if (!(await pathExists(keyPath))) {
      log.info(`  GPG キーを取得します: ${key.url}`);
      await $`curl -fsSL ${key.url}`.pipe($`sudo gpg --dearmor -o ${keyPath}`);
      await $`sudo chmod 644 ${keyPath}`;
    }

    // 同名 .sources があると Signed-By 競合を起こすため退避
    const sourcesConflict = `${SOURCES_DIR}/${key.name}.sources`;
    if (await pathExists(sourcesConflict)) {
      const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      await $`sudo mv ${sourcesConflict} ${`${sourcesConflict}.bak.${ts}`}`;
    }

    // 古い .list を削除（1password 以外、かつ .sources が無いとき）
    if (key.name !== "1password") {
      const oldList = `${SOURCES_DIR}/${key.name}.list`;
      if (await pathExists(oldList) && !(await pathExists(sourcesConflict))) {
        await $`sudo rm ${oldList}`;
      }
    }

    // __KEY_PATH__ を置換し、source 行に埋まったコマンド置換（$(...)）を bash で評価する
    const substituted = substituteKeyPath(key.sourceLine, keyPath);
    const resolved = (await $`bash -c ${`echo ${substituted}`}`.text()).trim();
    await $`sudo tee ${`${SOURCES_DIR}/${key.name}.list`}`.stdinText(`${resolved}\n`).quiet();

    // 1Password は公式 .sources があれば自前 .list を消す
    if (key.name === "1password" && await pathExists(sourcesConflict)) {
      await $`sudo rm ${`${SOURCES_DIR}/1password.list`}`;
    }
  }

  log.info("apt-get update を実行します");
  await $`sudo apt-get update`;
}
