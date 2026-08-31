import { assertEquals } from "@std/assert";
import { buildCrontabWith } from "./cron.ts";

Deno.test("buildCrontabWith: 空の crontab にエントリを追加する", () => {
  assertEquals(buildCrontabWith("", "@reboot /x/scan.sh"), "@reboot /x/scan.sh\n");
});

Deno.test("buildCrontabWith: 既存の他エントリを残して追加する", () => {
  const existing = "0 0 * * * /other.sh\n";
  assertEquals(
    buildCrontabWith(existing, "@reboot /x/scan.sh"),
    "0 0 * * * /other.sh\n@reboot /x/scan.sh\n",
  );
});

Deno.test("buildCrontabWith: 同一エントリを重複させない", () => {
  const existing = "@reboot /x/scan.sh\n";
  assertEquals(buildCrontabWith(existing, "@reboot /x/scan.sh"), "@reboot /x/scan.sh\n");
});

Deno.test("buildCrontabWith: コメント行・空行・設定行をそのまま残す", () => {
  const existing = "MAILTO=me\n\n# 毎晩のバックアップ\n0 0 * * * /other.sh\n";
  assertEquals(
    buildCrontabWith(existing, "@reboot /x/scan.sh"),
    "MAILTO=me\n\n# 毎晩のバックアップ\n0 0 * * * /other.sh\n@reboot /x/scan.sh\n",
  );
});

Deno.test("buildCrontabWith: コメントの中に同じ文字列があっても登録済みとみなさない", () => {
  const existing = "# 以前は @reboot /x/scan.sh を使っていた\n";
  assertEquals(
    buildCrontabWith(existing, "@reboot /x/scan.sh"),
    "# 以前は @reboot /x/scan.sh を使っていた\n@reboot /x/scan.sh\n",
  );
});

Deno.test("buildCrontabWith: 末尾に改行が無い crontab でも行を潰さない", () => {
  assertEquals(
    buildCrontabWith("0 0 * * * /other.sh", "@reboot /x/scan.sh"),
    "0 0 * * * /other.sh\n@reboot /x/scan.sh\n",
  );
});
