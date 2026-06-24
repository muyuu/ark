import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { $ } from "@david/dax";
import { log } from "./logger.ts";

/** github.com 用の SSH config ブロックを返す（先頭の空行込み。既存 config への追記を想定）。 */
export function githubSshConfig(keyfile: string): string {
  return [
    "",
    "Host github.com",
    "    HostName github.com",
    "    User git",
    `    IdentityFile ${keyfile}`,
    "    IdentitiesOnly yes",
    "",
  ].join("\n");
}

/** SSH config 内に github.com の Host 設定が既にあるか。 */
export function hasGithubHost(config: string): boolean {
  return config.includes("Host github.com");
}

/** 公開鍵文字列から鍵本体（2 番目のフィールド）を取り出す。GitHub 登録済み判定に使う。 */
export function publicKeyToken(pubkey: string): string {
  return pubkey.trim().split(/\s+/)[1] ?? "";
}

async function readFileOr(path: string, fallback: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return fallback;
    throw err;
  }
}

/** ~/.ssh/config に github.com 用の設定が無ければ追記する。既にあれば何もしない（冪等）。 */
export async function ensureSshConfig(homeDir: string, keyfile: string): Promise<void> {
  const sshDir = join(homeDir, ".ssh");
  const configPath = join(sshDir, "config");

  const existing = await readFileOr(configPath, "");
  if (hasGithubHost(existing)) return;

  await ensureDir(sshDir);
  await Deno.writeTextFile(configPath, existing + githubSshConfig(keyfile));
}

/** 鍵ファイルが無ければ ed25519 鍵を生成する。 */
async function ensureSshKey(keyfile: string, email: string): Promise<void> {
  if (await $.path(keyfile).exists()) {
    log.success(`✅ SSH 鍵は既に存在します: ${keyfile}`);
    return;
  }
  log.info(`🔑 SSH 鍵を生成しています: ${keyfile}`);
  await $`ssh-keygen -t ed25519 -C ${email} -f ${keyfile} -N ${""}`;
}

/**
 * 公開鍵を GitHub に登録する。gh が未認証なら警告して何もしない（対話認証は shell 側の
 * `gh auth login --web` で先に済ませる前提）。登録済みなら冪等にスキップする。
 */
async function registerKeyOnGithub(keyfile: string): Promise<void> {
  if (!(await $.commandExists("gh"))) {
    log.warning("⚠️ GitHub CLI がインストールされていません");
    return;
  }

  const pubfile = `${keyfile}.pub`;
  const token = publicKeyToken(await readFileOr(pubfile, ""));
  if (!token) {
    log.warning(`⚠️ SSH 公開鍵が見つかりません: ${pubfile}`);
    return;
  }

  if ((await $`gh auth status`.noThrow().quiet()).code !== 0) {
    log.warning("⚠️ GitHub CLI が未認証です（先に `gh auth login --web` を実行してください）");
    return;
  }

  const registered = await $`gh ssh-key list`.text();
  if (registered.includes(token)) {
    log.success("✅ この SSH 鍵は既に GitHub に登録されています");
    return;
  }
  const title = `${Deno.hostname()}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
  await $`gh ssh-key add ${pubfile} --title ${title}`;
  log.success(`✅ SSH 鍵を GitHub に登録しました: ${pubfile}`);
}

/**
 * GitHub 用の SSH 鍵を用意して登録する（非対話）。鍵生成・~/.ssh/config 追記・GitHub 登録まで行う。
 * メールは git の user.email を使い、鍵名は id_ed25519 固定。GitHub の認証自体は shell 側で済ませておく。
 */
export async function setupGithubSsh(homeDir: string): Promise<void> {
  const email = (await $`git config --global user.email`.noThrow().text()).trim() ||
    "ark@localhost";
  const keyfile = join(homeDir, ".ssh", "id_ed25519");

  await ensureSshKey(keyfile, email);
  await ensureSshConfig(homeDir, keyfile);
  await registerKeyOnGithub(keyfile);
}
