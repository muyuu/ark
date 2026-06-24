import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { type LinkPlan, planLinks } from "./dotfiles.ts";

function fakeLister(tree: Record<string, string[]>) {
  return (dir: string): string[] => tree[dir] ?? [];
}

function plan(tree: Record<string, string[]>): LinkPlan[] {
  return planLinks("/cfg", "/home", fakeLister(tree));
}

Deno.test("planLinks: トップレベルの dotfile を $HOME 直下へリンクする", () => {
  const plans = plan({ "/cfg": [".zshrc", ".vimrc"] });

  assertEquals(plans, [
    { source: "/cfg/.zshrc", target: "/home/.zshrc" },
    { source: "/cfg/.vimrc", target: "/home/.vimrc" },
  ]);
});

Deno.test("planLinks: 除外リストの項目はリンクしない", () => {
  const plans = plan({ "/cfg": [".zshrc", ".DS_Store", "Thumbs.db", "desktop.ini"] });

  assertEquals(plans, [{ source: "/cfg/.zshrc", target: "/home/.zshrc" }]);
});

Deno.test("planLinks: .config は自身ではなく中身を個別リンクする", () => {
  const plans = plan({
    "/cfg": [".config"],
    "/cfg/.config": ["mise", "config.toml"],
  });

  assertEquals(plans, [
    { source: join("/cfg/.config/mise"), target: join("/home/.config/mise") },
    { source: join("/cfg/.config/config.toml"), target: join("/home/.config/config.toml") },
  ]);
});

Deno.test("planLinks: .claude も中身を個別リンクする", () => {
  const plans = plan({
    "/cfg": [".claude"],
    "/cfg/.claude": ["CLAUDE.md"],
  });

  assertEquals(plans, [
    { source: "/cfg/.claude/CLAUDE.md", target: "/home/.claude/CLAUDE.md" },
  ]);
});

Deno.test("planLinks: .zsh.d も中身を個別リンクする（overlay マージ対応）", () => {
  const plans = plan({
    "/cfg": [".zsh.d"],
    "/cfg/.zsh.d": ["alias.zsh", "wt.zsh"],
  });

  assertEquals(plans, [
    { source: "/cfg/.zsh.d/alias.zsh", target: "/home/.zsh.d/alias.zsh" },
    { source: "/cfg/.zsh.d/wt.zsh", target: "/home/.zsh.d/wt.zsh" },
  ]);
});

Deno.test("planLinks: 隠しファイル以外は対象外", () => {
  const plans = plan({ "/cfg": ["README.md", ".zshrc"] });

  assertEquals(plans, [{ source: "/cfg/.zshrc", target: "/home/.zshrc" }]);
});
