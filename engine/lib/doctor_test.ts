import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import {
  diagnoseCommands,
  diagnoseKeys,
  diagnoseLinks,
  diagnoseOverlays,
  diagnosePackages,
  type Finding,
  formatFindings,
  parseAptPolicy,
} from "./doctor.ts";

function targets(findings: Finding[]): string[] {
  return findings.map((f) => f.target);
}

Deno.test("diagnoseLinks: 宣言どおりに張られていれば何も出ない", () => {
  const plans = [{ source: join("/cfg/.zshrc"), target: join("/home/.zshrc") }];

  assertEquals(diagnoseLinks(plans, () => join("/cfg/.zshrc")), []);
});

Deno.test("diagnoseLinks: リンクが無い・別の先を指している物を挙げる", () => {
  const plans = [
    { source: join("/cfg/.zshrc"), target: join("/home/.zshrc") },
    { source: join("/cfg/.vimrc"), target: join("/home/.vimrc") },
    { source: join("/cfg/.gitconfig"), target: join("/home/.gitconfig") },
  ];
  // .zshrc は正しい / .vimrc は symlink でない / .gitconfig は別の先
  const readLink = (target: string) => {
    if (target === join("/home/.zshrc")) return join("/cfg/.zshrc");
    if (target === join("/home/.vimrc")) return undefined;
    return join("/other/.gitconfig");
  };

  assertEquals(targets(diagnoseLinks(plans, readLink)), [
    join("/home/.vimrc"),
    join("/home/.gitconfig"),
  ]);
});

Deno.test("diagnoseOverlays: 登録済みなのに取得されていない overlay を挙げる", () => {
  const overlays = [
    { name: "personal", dir: join("/ghq/personal") },
    { name: "work", dir: undefined },
    { name: "lab", dir: join("/ghq/lab") },
  ];

  assertEquals(
    targets(diagnoseOverlays(overlays, (d) => d === join("/ghq/personal"))),
    ["work", "lab"],
  );
});

Deno.test("diagnoseCommands: ビルドされていない自前コマンドを挙げる", () => {
  assertEquals(targets(diagnoseCommands(["wt", "other"], (n) => n === "wt")), ["other"]);
});

Deno.test("diagnoseKeys: 鍵ファイルと Host ブロックの欠けを別々に挙げる", () => {
  const keys = [
    { name: "default", file: join("/home/.ssh/id_ed25519"), host: "github.com" },
    { name: "work", file: join("/home/.ssh/id_ed25519_work"), host: "github.com-work" },
    { name: "plain", file: join("/home/.ssh/id_ed25519_plain") },
  ];
  const config = "Host github.com\n    IdentityFile x\n";

  const findings = diagnoseKeys(keys, (f) => f !== join("/home/.ssh/id_ed25519_work"), config);

  assertEquals(findings.map((f) => `${f.target}: ${f.detail}`), [
    "work: 鍵ファイルがありません",
    "work: ~/.ssh/config に Host ブロックがありません",
  ]);
});

Deno.test("parseAptPolicy: パッケージごとの候補を読む", () => {
  const output = [
    "vim:",
    "  Installed: 2:9.1.0016-1ubuntu7.20",
    "  Candidate: 2:9.1.0016-1ubuntu7.20",
    "nosuch:",
    "  Installed: (none)",
    "  Candidate: (none)",
  ].join("\n");

  const candidates = parseAptPolicy(output);

  assertEquals(candidates.get("vim"), "2:9.1.0016-1ubuntu7.20");
  assertEquals(candidates.get("nosuch"), undefined);
});

Deno.test("diagnosePackages: 候補の無い宣言を挙げる（distro マップの漏れを見つける）", () => {
  const candidates = new Map([["vim", "9.1"]]);

  assertEquals(targets(diagnosePackages(["vim", "nosuch"], candidates)), ["nosuch"]);
});

Deno.test("formatFindings: 観点ごとにまとめて出す", () => {
  const findings: Finding[] = [
    { area: "dotfiles", target: "~/.vimrc", detail: "リンクがありません" },
    {
      area: "dotfiles",
      target: "~/.gitconfig",
      detail: "別の先を指しています",
      hint: "ark link-dotfiles",
    },
    { area: "overlay", target: "work", detail: "取得されていません" },
  ];

  assertEquals(formatFindings(findings), [
    "[dotfiles]",
    "  ~/.vimrc: リンクがありません",
    "  ~/.gitconfig: 別の先を指しています → ark link-dotfiles",
    "[overlay]",
    "  work: 取得されていません",
  ]);
});
