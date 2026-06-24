import { assertEquals } from "@std/assert";
import { missingFromManifest, parseBrewfileEntries, parseLines } from "./audit.ts";

Deno.test("parseBrewfileEntries: brew / cask を分けて取り出す", () => {
  const content = '# 見出し\nbrew "git"\ncask "spotify"\nbrew "jq"  # コメント\n';
  assertEquals(parseBrewfileEntries(content), { formulae: ["git", "jq"], casks: ["spotify"] });
});

Deno.test("parseBrewfileEntries: tap 付き formula は末尾の名前だけ", () => {
  assertEquals(parseBrewfileEntries('brew "org/tap/tool"\n').formulae, ["tool"]);
});

Deno.test("parseLines: 1 行 1 名・空行無視", () => {
  assertEquals(parseLines("git\n\njq\n"), ["git", "jq"]);
});

Deno.test("missingFromManifest: 実体にあって宣言に無いものだけ返す", () => {
  assertEquals(missingFromManifest(["git", "jq", "fd"], ["git", "jq"]), ["fd"]);
  assertEquals(missingFromManifest(["git"], ["git", "jq"]), []);
});
