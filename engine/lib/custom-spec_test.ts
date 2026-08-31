import { assertEquals } from "@std/assert";
import { parseCustomApps, selectInstallMethod } from "./custom-spec.ts";

const MANIFEST = `
[[app]]
name = "zed"
commands = ["zed", "zeditor"]

  [app.install.arch]
  package = "zed"

  [app.install.default]
  script = "https://zed.dev/install.sh"

[[app]]
name = "ghostty"
commands = ["ghostty"]

  [app.install.debian]
  package = "ghostty"
  ppa = "ppa:mkasberg/ghostty-ubuntu"

[[app]]
name = "reaper"

[[app]]
commands = ["nameless"]
`;

Deno.test("parseCustomApps: 宣言を順序を保って読み、name の無いものは捨てる", () => {
  const apps = parseCustomApps(MANIFEST);

  assertEquals(apps.map((a) => a.name), ["zed", "ghostty", "reaper"]);
});

Deno.test("parseCustomApps: 導入済み判定と導入方法を読む", () => {
  const [zed] = parseCustomApps(MANIFEST);

  assertEquals(zed.commands, ["zed", "zeditor"]);
  assertEquals(zed.paths, []);
  assertEquals(zed.install.arch, { package: "zed" });
  assertEquals(zed.install.default, { script: "https://zed.dev/install.sh" });
});

Deno.test("parseCustomApps: install が無い宣言は engine の installer に任せる印になる", () => {
  const reaper = parseCustomApps(MANIFEST)[2];

  assertEquals(reaper.install, {});
  assertEquals(reaper.commands, []);
});

Deno.test("selectInstallMethod: distro に対応する方法を選ぶ", () => {
  const [zed, ghostty] = parseCustomApps(MANIFEST);

  assertEquals(selectInstallMethod(zed, "arch"), { package: "zed" });
});

Deno.test("selectInstallMethod: 該当が無ければ default に落ちる", () => {
  const [zed] = parseCustomApps(MANIFEST);

  assertEquals(selectInstallMethod(zed, "debian"), { script: "https://zed.dev/install.sh" });
  assertEquals(selectInstallMethod(zed, undefined), { script: "https://zed.dev/install.sh" });
});

Deno.test("selectInstallMethod: default も無ければ undefined（その distro では入れない）", () => {
  const ghostty = parseCustomApps(MANIFEST)[1];

  assertEquals(selectInstallMethod(ghostty, "arch"), undefined);
});
