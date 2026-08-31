import { parse as parseToml } from "@std/toml";

/**
 * 1 つの distro における導入方法。どれか 1 つを指定する（`ppa` だけは `package` の補助）。
 *
 * ここに書けない手順（配布ページの解析やパッチ当てなど）は engine 側の installer が持つ。
 * その場合は宣言に `name` だけを書き、`install` を空にする。
 */
export interface InstallMethod {
  /** distro の package manager で入れるパッケージ名。 */
  package?: string;
  /** `package` の候補が apt に無いときだけ足す PPA（Debian 系専用）。 */
  ppa?: string;
  /** `curl -fsSL <url> | sh` で流す公式インストールスクリプトの URL。 */
  script?: string;
  /** 展開して置く tarball の URL。 */
  tarball?: string;
  /** tarball の展開先ディレクトリ（既定 `/opt`）。 */
  dest?: string;
}

/** custom マニフェスト（`app/<os>/custom.toml`）で宣言されたアプリ 1 件。 */
export interface CustomApp {
  /** アプリの識別子。engine の installer に任せる場合はその名前になる。 */
  name: string;
  /** 導入済み判定に使うコマンド名（いずれか 1 つでもあれば導入済み）。 */
  commands: string[];
  /** 導入済み判定に使うパス（PATH に載らない物のため）。 */
  paths: string[];
  /** distro 名 → 導入方法。`default` は該当が無いときのフォールバック。空なら engine に任せる。 */
  install: Record<string, InstallMethod>;
}

const METHOD_FIELDS = ["package", "ppa", "script", "tarball", "dest"] as const;

function toStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function toMethod(raw: unknown): InstallMethod {
  const method: InstallMethod = {};
  if (typeof raw !== "object" || raw === null) return method;
  const record = raw as Record<string, unknown>;
  for (const field of METHOD_FIELDS) {
    if (typeof record[field] === "string") method[field] = record[field] as string;
  }
  return method;
}

function toInstall(raw: unknown): Record<string, InstallMethod> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([distro, m]) => [distro, toMethod(m)]),
  );
}

/** custom マニフェストを解釈する。`[[app]]` 配列から name のあるものだけを順序を保って返す。 */
export function parseCustomApps(toml: string): CustomApp[] {
  const parsed = parseToml(toml) as { app?: Array<Record<string, unknown>> };

  return (parsed.app ?? [])
    .filter((app) => typeof app.name === "string")
    .map((app) => ({
      name: app.name as string,
      commands: toStrings(app.commands),
      paths: toStrings(app.paths),
      install: toInstall(app.install),
    }));
}

/**
 * この distro での導入方法を選ぶ。distro 名の指定 → `default` の順に見て、どちらも無ければ
 * undefined（その distro では入れない）。
 */
export function selectInstallMethod(
  app: CustomApp,
  distro: string | undefined,
): InstallMethod | undefined {
  return (distro !== undefined ? app.install[distro] : undefined) ?? app.install.default;
}
