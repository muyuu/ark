import { assertEquals } from "@std/assert";
import { buildCrontabWith, registerSecurityScanCron } from "./cron.ts";

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

function fakeCrontab(initial: string) {
  const io = {
    content: initial,
    writes: 0,
    read: () => Promise.resolve(io.content),
    write: (next: string) => {
      io.content = next;
      io.writes += 1;
      return Promise.resolve();
    },
  };
  return io;
}

Deno.test("registerSecurityScanCron: 既存を読んで @reboot エントリを足した内容を書き戻す", async () => {
  const io = fakeCrontab("MAILTO=me\n0 0 * * * /backup.sh\n");
  await registerSecurityScanCron("/x/mise scan", io);
  assertEquals(io.content, "MAILTO=me\n0 0 * * * /backup.sh\n@reboot /x/mise scan\n");
});

Deno.test("registerSecurityScanCron: crontab 未設定（空）でも登録できる", async () => {
  const io = fakeCrontab("");
  await registerSecurityScanCron("/x/scan", io);
  assertEquals(io.content, "@reboot /x/scan\n");
});

Deno.test("registerSecurityScanCron: 既に登録済みなら重複させずそのまま書き戻す", async () => {
  const io = fakeCrontab("@reboot /x/scan\n");
  await registerSecurityScanCron("/x/scan", io);
  assertEquals(io.content, "@reboot /x/scan\n");
  assertEquals(io.writes, 1);
});
