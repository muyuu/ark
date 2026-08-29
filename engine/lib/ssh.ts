import { join } from "@std/path";
import { parse as parseToml } from "@std/toml";
import { ensureDir } from "@std/fs";
import { $ } from "@david/dax";
import { log } from "./logger.ts";

/**
 * 宣言 1 件ぶんの SSH 鍵。鍵はマシンの資産で、どのサービスに登録するかは別の関心。
 * host 以下は「その鍵をどの接続先に固定するか」で、省略すると鍵を作るだけになる。
 */
export interface KeyDecl {
  /** 鍵の識別子。ファイル名を導く。 */
  name: string;
  /** ssh config の Host 名。同じホストへ複数の鍵を使い分けるときはエイリアスを置く。 */
  host?: string;
  /** 接続先の実ホスト。省略すると host と同じ（エイリアスを使うときだけ要る）。 */
  hostname?: string;
  /** 接続に使うユーザ名。省略すると User 行を書かない。 */
  user?: string;
  /** 公開鍵のコメント。省略すると git の user.email を使う。 */
  comment?: string;
}

/** 宣言を解決した、このマシンが持つべき鍵 1 本。 */
export interface SshKey extends KeyDecl {
  /** 秘密鍵の絶対パス。公開鍵は `${file}.pub`。 */
  file: string;
}

/** machine-local の鍵宣言ファイルのパス。 */
export function keysConfigPath(homeDir: string): string {
  return join(homeDir, ".config", "ark", "ssh-keys.toml");
}

/**
 * 鍵の名前から秘密鍵のパスを導く。`default` だけは ssh のデフォルト ID（`id_ed25519`）に置き、
 * ssh config が無くても単体で使えるようにする。
 */
export function keyFile(homeDir: string, name: string): string {
  const base = name === "default" ? "id_ed25519" : `id_ed25519_${name}`;
  return join(homeDir, ".ssh", base);
}

/** 宣言に鍵ファイルのパスを与えて解決する。 */
export function resolveKeys(homeDir: string, decls: KeyDecl[]): SshKey[] {
  return decls.map((decl) => ({ ...decl, file: keyFile(homeDir, decl.name) }));
}

/** ssh-keys.toml を解釈する。`[[key]]` 配列から name のあるものだけを順序を保って返す。 */
export function parseKeyDecls(toml: string): KeyDecl[] {
  const parsed = parseToml(toml) as {
    key?: Array<Record<string, unknown>>;
  };

  return (parsed.key ?? [])
    .filter((k) => typeof k.name === "string")
    .map((k) => {
      const decl: KeyDecl = { name: k.name as string };
      for (const field of ["host", "hostname", "user", "comment"] as const) {
        if (typeof k[field] === "string") decl[field] = k[field] as string;
      }
      return decl;
    });
}

/** layer 順（machine-local → overlay）に宣言を重ねる。同名は後勝ちで、初出の順序を保つ。 */
export function mergeKeyDecls(...layers: KeyDecl[][]): KeyDecl[] {
  const merged = new Map<string, KeyDecl>();
  for (const decl of layers.flat()) merged.set(decl.name, decl);
  return [...merged.values()];
}

/** 鍵 1 本を固定する Host ブロックを返す（先頭の空行込み。既存 config への追記を想定）。 */
export function sshConfigBlock(key: SshKey): string {
  const lines = [
    "",
    `Host ${key.host}`,
    `    HostName ${key.hostname ?? key.host}`,
  ];
  if (key.user) lines.push(`    User ${key.user}`);
  lines.push(`    IdentityFile ${key.file}`, "    IdentitiesOnly yes", "");
  return lines.join("\n");
}

/**
 * ssh config にその Host 名のブロックが既にあるか。`github.com` と `github.com-work` のような
 * 前方一致する別ホストを取り違えないよう、Host 行を行単位で見る。
 */
export function hasHostBlock(config: string, host: string): boolean {
  return config.split("\n").some((line) => {
    const m = line.match(/^\s*Host\s+(.+?)\s*$/i);
    return m ? m[1].split(/\s+/).includes(host) : false;
  });
}

async function readFileOr(path: string, fallback: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return fallback;
    throw err;
  }
}

/** 宣言ファイルを読む。無ければ空配列。 */
export async function loadKeyDecls(path: string): Promise<KeyDecl[]> {
  return parseKeyDecls(await readFileOr(path, ""));
}

/** 鍵ファイルが無ければ ed25519 鍵を生成する。 */
export async function ensureKey(key: SshKey, fallbackComment: string): Promise<void> {
  if (await $.path(key.file).exists()) {
    log.success(`✅ SSH 鍵は既に存在します: ${key.file}`);
    return;
  }
  log.info(`🔑 SSH 鍵を生成しています: ${key.file}`);
  await ensureDir(join(key.file, ".."));
  await $`ssh-keygen -t ed25519 -C ${key.comment ?? fallbackComment} -f ${key.file} -N ${""}`;
}

/** ~/.ssh/config にその鍵の Host ブロックが無ければ追記する。既にあれば何もしない（冪等）。 */
export async function ensureHostBlock(homeDir: string, key: SshKey): Promise<void> {
  if (!key.host) return;

  const sshDir = join(homeDir, ".ssh");
  const configPath = join(sshDir, "config");

  const existing = await readFileOr(configPath, "");
  if (hasHostBlock(existing, key.host)) return;

  await ensureDir(sshDir);
  await Deno.writeTextFile(configPath, existing + sshConfigBlock(key));
}

/** 公開鍵を読む。無ければ空文字。 */
export function readPublicKey(key: SshKey): Promise<string> {
  return readFileOr(`${key.file}.pub`, "");
}
