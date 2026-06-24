import { assertEquals } from "@std/assert";
import { parseCustomList } from "./custom.ts";

Deno.test("parseCustomList: 1 行 1 名・コメント/空行を無視する", () => {
  const content = "# DTM\nreaper\n\ndrumgizmo  # 音源\n";
  assertEquals(parseCustomList(content), ["reaper", "drumgizmo"]);
});

Deno.test("parseCustomList: 空内容は空配列", () => {
  assertEquals(parseCustomList(""), []);
});
