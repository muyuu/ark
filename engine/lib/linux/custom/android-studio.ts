import { $ } from "@david/dax";
import { log } from "../../logger.ts";

// Android Studio Linux 版のダウンロード URL。新バージョンが出たら更新が必要。
const ANDROID_STUDIO_URL =
  "https://redirector.gvt1.com/edgedl/android/studio/ide-zips/2025.1.2.11/android-studio-2025.1.2.11-linux.tar.gz";

/** Android Studio（Linux 版）を /opt に展開してセットアップを起動する。導入済みなら何もしない。 */
export async function installAndroidStudio(): Promise<void> {
  if (Deno.build.os !== "linux") {
    log.warning("Android Studio の導入は Linux 専用です");
    return;
  }

  // /opt 配下は PATH に載らないため、コマンドの有無だけでなく展開先の有無も見る。
  const installed = await $.commandExists("android-studio") ||
    await $.path("/opt/android-studio").exists();
  if (installed) {
    log.success("Android Studio は既にインストールされています");
    return;
  }

  log.info("Android Studio をインストールします...");
  const archive = "/tmp/android-studio.tar.gz";
  await $`wget -O ${archive} ${ANDROID_STUDIO_URL}`;
  await $`sudo tar -xzf ${archive} -C /opt`;
  await Deno.remove(archive);
  // 初回のセットアップウィザードはここでは起動しない。GUI が閉じられるまで install 全体が止まるため。
  log.info(
    "Android Studio を展開しました。初回起動は /opt/android-studio/bin/studio.sh から行ってください",
  );
}
