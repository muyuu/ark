/** ファイルを読む。存在しなければ fallback を返す（NotFound のみ握りつぶす）。 */
export async function readTextOr(path: string, fallback: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return fallback;
    throw err;
  }
}
