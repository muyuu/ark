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

Deno.test("buildCrontabWith: コメント行・空行は落とす", () => {
  const existing = "# my cron\n\n0 0 * * * /other.sh\n";
  assertEquals(
    buildCrontabWith(existing, "@reboot /x/scan.sh"),
    "0 0 * * * /other.sh\n@reboot /x/scan.sh\n",
  );
});
