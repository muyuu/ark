import { repoToSsh } from "./lib/git-remote.ts";

/** カレント git リポジトリの origin を HTTPS から SSH へ切り替える。 */
if (import.meta.main) {
  await repoToSsh();
}
