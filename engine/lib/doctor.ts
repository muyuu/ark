import type { LinkPlan } from "./dotfiles.ts";
import { hasHostBlock } from "./ssh.ts";

/**
 * 健全性チェックで見つかった 1 件。
 *
 * audit が「実機にあって宣言に無い物」を探すのに対し、doctor は逆——**宣言にあるのに実機で
 * 効いていない物**を探す。どちらも直すのは人なので、何をすればよいかまで書く。
 */
export interface Finding {
  /** 観点（`dotfiles` / `overlay` / `command` / `ssh` / `package`）。 */
  area: string;
  /** 問題のある対象。 */
  target: string;
  /** 何が起きているか。 */
  detail: string;
  /** どう直すか。分かる場合だけ。 */
  hint?: string;
}

/** 観点ごとにまとめた表示用の行。 */
export function formatFindings(findings: Finding[]): string[] {
  const lines: string[] = [];
  let current = "";
  for (const finding of findings) {
    if (finding.area !== current) {
      lines.push(`[${finding.area}]`);
      current = finding.area;
    }
    const hint = finding.hint ? ` → ${finding.hint}` : "";
    lines.push(`  ${finding.target}: ${finding.detail}${hint}`);
  }
  return lines;
}

/**
 * dotfiles が宣言どおりに張られているか。
 *
 * readLink は target の symlink 先を返す（symlink でなければ undefined）。実体のファイルに
 * 置き換わっている場合と、別の layer/リポジトリを指している場合を区別して挙げる。
 */
export function diagnoseLinks(
  plans: LinkPlan[],
  readLink: (target: string) => string | undefined,
): Finding[] {
  const findings: Finding[] = [];
  for (const { source, target } of plans) {
    const actual = readLink(target);
    if (actual === source) continue;
    findings.push({
      area: "dotfiles",
      target,
      detail: actual === undefined ? "リンクがありません" : `別の先を指しています: ${actual}`,
      hint: "ark link-dotfiles",
    });
  }
  return findings;
}

/** 登録されているのに取得されていない overlay。宣言が丸ごと効いていない状態。 */
export function diagnoseOverlays(
  overlays: Array<{ name: string; dir: string | undefined }>,
  exists: (dir: string) => boolean,
): Finding[] {
  return overlays
    .filter((o) => o.dir === undefined || !exists(o.dir))
    .map((o) => ({
      area: "overlay",
      target: o.name,
      detail: o.dir === undefined ? "URL を解釈できません" : "取得されていません",
      hint: "ark overlay",
    }));
}

/** ビルドされていない自前コマンド（`~/.local/bin` に無い物）。 */
export function diagnoseCommands(names: string[], installed: (name: string) => boolean): Finding[] {
  return names
    .filter((name) => !installed(name))
    .map((name) => ({
      area: "command",
      target: name,
      detail: "ビルドされていません",
      hint: "ark install",
    }));
}

/** 宣言された SSH 鍵のうち、鍵ファイルか Host ブロックが欠けている物。 */
export function diagnoseKeys(
  keys: Array<{ name: string; file: string; host?: string }>,
  exists: (file: string) => boolean,
  sshConfig: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const key of keys) {
    if (!exists(key.file)) {
      findings.push({
        area: "ssh",
        target: key.name,
        detail: "鍵ファイルがありません",
        hint: "ark ssh-keys",
      });
    }
    if (key.host && !hasHostBlock(sshConfig, key.host)) {
      findings.push({
        area: "ssh",
        target: key.name,
        detail: "~/.ssh/config に Host ブロックがありません",
        hint: "ark ssh-keys",
      });
    }
  }
  return findings;
}

/**
 * `apt-cache policy <pkg>…` の出力からパッケージ名→候補バージョンを読む。
 * 候補が `(none)` のものは「その名前では入らない」ので入れない。
 */
export function parseAptPolicy(output: string): Map<string, string> {
  const candidates = new Map<string, string>();
  let current = "";
  for (const line of output.split("\n")) {
    const name = line.match(/^(\S+):\s*$/)?.[1];
    if (name) {
      current = name;
      continue;
    }
    const candidate = line.match(/^\s+Candidate:\s*(\S+)/)?.[1];
    if (current && candidate && candidate !== "(none)") candidates.set(current, candidate);
  }
  return candidates;
}

/**
 * package manager が知らない宣言。distro マップの漏れ（論理名がそのまま渡っている）を見つける。
 * この状態のまま install すると、その distro の導入がその 1 件ぶん失敗する。
 */
export function diagnosePackages(declared: string[], candidates: Map<string, string>): Finding[] {
  return declared
    .filter((name) => !candidates.has(name))
    .map((name) => ({
      area: "package",
      target: name,
      detail: "package manager に候補がありません",
      hint: "app/linux/distro/<distro>.map で実名に変換する",
    }));
}
