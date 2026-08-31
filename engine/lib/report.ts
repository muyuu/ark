import { log, Logger } from "./logger.ts";

/**
 * 適用できなかったものを集めて、実行の最後にまとめて出す。
 *
 * 1 つの導入に失敗しても他は進めたい（宣言の大半は独立している）が、途中の警告はログに流れて
 * 消えるので、何が入らなかったのかが残らない。ここに集約して最後に一度だけ見せる。
 */
export class InstallReport {
  // 経路名 → 失敗した対象。初出の順を保つため Map を使う。
  readonly #failures = new Map<string, Set<string>>();

  /** 失敗を 1 件記録する。step は経路名（`apt` / `brew` / `custom` など）。 */
  record(step: string, target: string): void {
    const targets = this.#failures.get(step) ?? new Set<string>();
    targets.add(target);
    this.#failures.set(step, targets);
  }

  get hasFailures(): boolean {
    return this.#failures.size > 0;
  }

  /** 経路ごとに 1 行へまとめた要約。失敗が無ければ空配列。 */
  summary(): string[] {
    return [...this.#failures].map(([step, targets]) => `${step}: ${[...targets].join(", ")}`);
  }

  /** 要約を出力する。失敗が無ければ何もしない。 */
  print(logger: Logger = log): void {
    if (!this.hasFailures) return;
    logger.warning("⚠️ 適用できなかったものがあります:");
    for (const line of this.summary()) logger.warning(`   ${line}`);
  }
}

/** 実行全体で共有する既定のレポート。 */
export const report: InstallReport = new InstallReport();
