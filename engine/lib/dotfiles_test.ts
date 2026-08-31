import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { linkDotfiles, type LinkPlan, planLinks } from "./dotfiles.ts";
import { Logger } from "./logger.ts";

// パスは OS の区切り文字で組み立てる（planLinks が join を使うため、期待値も同じ形にする）。
const CFG = join("/cfg");
const HOME = join("/home");

/**
 * この環境で symlink を作れるか。Windows は開発者モード（または管理者）が無いと作れず、
 * 本番の linkDotfiles もその場合は警告してスキップする。作れない環境では symlink を張る
 * テストを実行しても環境の制約を再確認するだけなので飛ばす。
 */
function canSymlink(): boolean {
  const dir = Deno.makeTempDirSync();
  try {
    Deno.symlinkSync(dir, join(dir, "link"), { type: "dir" });
    return true;
  } catch {
    return false;
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
}

function fakeLister(tree: Record<string, string[]>) {
  return (dir: string): string[] => tree[dir] ?? [];
}

function plan(tree: Record<string, string[]>): LinkPlan[] {
  return planLinks(CFG, HOME, fakeLister(tree));
}

/** configDir 内の相対パスから、期待するリンク計画 1 件を組み立てる。 */
function expected(...parts: string[]): LinkPlan {
  return { source: join(CFG, ...parts), target: join(HOME, ...parts) };
}

Deno.test("planLinks: トップレベルの dotfile を $HOME 直下へリンクする", () => {
  const plans = plan({ [CFG]: [".zshrc", ".vimrc"] });

  assertEquals(plans, [expected(".zshrc"), expected(".vimrc")]);
});

Deno.test("planLinks: 除外リストの項目はリンクしない", () => {
  const plans = plan({ [CFG]: [".zshrc", ".DS_Store", "Thumbs.db", "desktop.ini"] });

  assertEquals(plans, [expected(".zshrc")]);
});

Deno.test("planLinks: .config は自身ではなく中身を個別リンクする", () => {
  const plans = plan({
    [CFG]: [".config"],
    [join(CFG, ".config")]: ["mise", "config.toml"],
  });

  assertEquals(plans, [expected(".config", "mise"), expected(".config", "config.toml")]);
});

Deno.test("planLinks: .claude も中身を個別リンクする", () => {
  const plans = plan({
    [CFG]: [".claude"],
    [join(CFG, ".claude")]: ["CLAUDE.md"],
  });

  assertEquals(plans, [expected(".claude", "CLAUDE.md")]);
});

Deno.test("planLinks: .zsh.d も中身を個別リンクする（overlay マージ対応）", () => {
  const plans = plan({
    [CFG]: [".zsh.d"],
    [join(CFG, ".zsh.d")]: ["alias.zsh", "wt.zsh"],
  });

  assertEquals(plans, [expected(".zsh.d", "alias.zsh"), expected(".zsh.d", "wt.zsh")]);
});

Deno.test("planLinks: 隠しファイル以外は対象外", () => {
  const plans = plan({ [CFG]: ["README.md", ".zshrc"] });

  assertEquals(plans, [expected(".zshrc")]);
});

Deno.test({
  name: "linkDotfiles: 既存のディレクトリ symlink を実体化して子をリンクする（ソースを壊さない）",
  ignore: !canSymlink(),
  async fn() {
    const base = await Deno.makeTempDir();
    try {
      const config = join(base, "config");
      const home = join(base, "home");
      await Deno.mkdir(join(config, ".zsh.d"), { recursive: true });
      await Deno.writeTextFile(join(config, ".zsh.d", "a.zsh"), "echo a");
      await Deno.mkdir(home, { recursive: true });
      // 旧来のディレクトリ symlink: ~/.zsh.d -> config/.zsh.d
      await Deno.symlink(join(config, ".zsh.d"), join(home, ".zsh.d"), { type: "dir" });

      await linkDotfiles(config, home, new Logger("none"));

      // ソースは壊れていない
      assertEquals(await Deno.readTextFile(join(config, ".zsh.d", "a.zsh")), "echo a");
      // ~/.zsh.d は実ディレクトリ化され、子が symlink になっている
      assertEquals((await Deno.lstat(join(home, ".zsh.d"))).isDirectory, true);
      assertEquals((await Deno.lstat(join(home, ".zsh.d", "a.zsh"))).isSymlink, true);
    } finally {
      await Deno.remove(base, { recursive: true });
    }
  },
});
