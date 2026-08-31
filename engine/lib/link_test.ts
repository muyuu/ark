import { assertEquals } from "@std/assert";
import { isWindowsDotfile } from "./link.ts";

Deno.test("isWindowsDotfile: native Windows で実際に読まれる物だけを通す", () => {
  assertEquals(isWindowsDotfile(".gitconfig"), true);
  assertEquals(isWindowsDotfile(".config/tig"), true);
});

Deno.test("isWindowsDotfile: .claude 配下は丸ごと通す（Claude Code が読む）", () => {
  assertEquals(isWindowsDotfile(".claude/CLAUDE.md"), true);
  assertEquals(isWindowsDotfile(".claude/settings.json"), true);
  assertEquals(isWindowsDotfile(".claude/notify.sh"), true);
});

Deno.test("isWindowsDotfile: native Windows で読まれない物は通さない", () => {
  assertEquals(isWindowsDotfile(".zshrc"), false);
  assertEquals(isWindowsDotfile(".zsh.d/alias.zsh"), false);
  assertEquals(isWindowsDotfile(".config/nvim"), false);
  // 前方一致で別の物を巻き込まない
  assertEquals(isWindowsDotfile(".gitconfig.local"), false);
  assertEquals(isWindowsDotfile(".claude-backup/x"), false);
});
