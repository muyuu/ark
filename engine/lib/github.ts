import { $ } from "@david/dax";
import { log } from "./logger.ts";
import {
  ensureHostBlock,
  ensureKey,
  type KeyDecl,
  readPublicKey,
  resolveKeys,
  type SshKey,
} from "./ssh.ts";

/**
 * github.com へ登録する既定の鍵。bootstrap は overlay を SSH で引くので、宣言が無いマシンでも
 * この 1 本だけは用意される。
 */
export const GITHUB_KEY_DECL: KeyDecl = { name: "default", host: "github.com", user: "git" };

/** 公開鍵文字列から鍵本体（2 番目のフィールド）を取り出す。GitHub 登録済み判定に使う。 */
export function publicKeyToken(pubkey: string): string {
  return pubkey.trim().split(/\s+/)[1] ?? "";
}

/** `gh ssh-key list` の出力にこの公開鍵が含まれるか。鍵が読めなければ登録済みとみなさない。 */
export function isKeyRegistered(listOutput: string, pubkey: string): boolean {
  const token = publicKeyToken(pubkey);
  return token !== "" && listOutput.includes(token);
}

/**
 * 公開鍵を GitHub に登録する。gh が未認証なら警告して何もしない（対話認証は呼び出し側で
 * 済ませる前提）。登録済みなら冪等にスキップする。
 */
export async function registerKeyOnGithub(key: SshKey): Promise<void> {
  if (!(await $.commandExists("gh"))) {
    log.warning("⚠️ GitHub CLI がインストールされていません");
    return;
  }

  const pubfile = `${key.file}.pub`;
  const pubkey = await readPublicKey(key);
  if (!pubkey.trim()) {
    log.warning(`⚠️ SSH 公開鍵が見つかりません: ${pubfile}`);
    return;
  }

  if ((await $`gh auth status`.noThrow().quiet()).code !== 0) {
    log.warning("⚠️ GitHub CLI が未認証です（先に `gh auth login --web` を実行してください）");
    return;
  }

  if (isKeyRegistered(await $`gh ssh-key list`.text(), pubkey)) {
    log.success(`✅ この SSH 鍵は既に GitHub に登録されています: ${pubfile}`);
    return;
  }

  const title = `${Deno.hostname()}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
  await $`gh ssh-key add ${pubfile} --title ${title}`;
  log.success(`✅ SSH 鍵を GitHub に登録しました: ${pubfile}`);
}

/** 既定鍵を解決する。 */
export function githubKey(homeDir: string): SshKey {
  return resolveKeys(homeDir, [GITHUB_KEY_DECL])[0];
}

/**
 * 渡された鍵を github.com 用に用意する（鍵の生成・ssh config への追記・GitHub への登録）。
 * それぞれ独立に冪等なので、鍵だけある／config だけあるマシンでも足りない分を埋める。
 */
export async function setupGithubSsh(homeDir: string, key: SshKey = githubKey(homeDir)) {
  const email = (await $`git config --global user.email`.noThrow().text()).trim() ||
    "ark@localhost";

  await ensureKey(key, email);
  await ensureHostBlock(homeDir, key);
  await registerKeyOnGithub(key);
}

/**
 * private overlay を引けるよう GitHub 認証と SSH 鍵を整える。gh が未認証ならブラウザ認証
 * （対話。`ark overlay add` を対話シェルから叩く前提）を行い、続けて既定鍵を用意・登録する。
 */
export async function ensureGithubSshReady(homeDir: string): Promise<void> {
  if (!(await $.commandExists("gh"))) {
    log.warning("⚠️ GitHub CLI が無いため認証をスキップします（private overlay は取得できません）");
    return;
  }
  if ((await $`gh auth status`.noThrow().quiet()).code !== 0) {
    log.info("▶ GitHub にログインします（ブラウザ認証）...");
    await $`gh auth login --git-protocol ssh --web`;
  }
  await setupGithubSsh(homeDir);
}
