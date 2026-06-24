export type LogLevel = "none" | "error" | "warning" | "info" | "verbose";

const RANK: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warning: 2,
  info: 3,
  verbose: 4,
};

/** 文字列を LogLevel に解釈する。未知の値・未指定は info を返す。 */
export function parseLevel(raw?: string): LogLevel {
  return raw !== undefined && raw in RANK ? raw as LogLevel : "info";
}

/** ログ出力先。テスト時に差し替えられるよう外から注入する。 */
export interface Sinks {
  out: (line: string) => void;
  err: (line: string) => void;
}

const RESET = "\x1b[0m";
const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[0;33m";
const BLUE = "\x1b[0;34m";
const MAGENTA = "\x1b[0;35m";

const defaultSinks: Sinks = {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

/**
 * レベル閾値付きのロガー。コンストラクタの level 以下の重要度のメッセージだけを出力する。
 * error は err シンク、それ以外は out シンクへ送る。
 */
export class Logger {
  readonly #rank: number;
  readonly #sinks: Sinks;

  constructor(level: LogLevel = "info", sinks: Sinks = defaultSinks) {
    this.#rank = RANK[level];
    this.#sinks = sinks;
  }

  #emit(threshold: LogLevel, color: string, label: string, msg: string, sink: (l: string) => void) {
    if (RANK[threshold] <= this.#rank) {
      sink(`${color}${label}: ${msg}${RESET}`);
    }
  }

  debug(msg: string) {
    this.#emit("verbose", MAGENTA, "DEBUG", msg, this.#sinks.out);
  }

  info(msg: string) {
    this.#emit("info", BLUE, "INFO", msg, this.#sinks.out);
  }

  success(msg: string) {
    this.#emit("info", GREEN, "SUCCESS", msg, this.#sinks.out);
  }

  warning(msg: string) {
    this.#emit("warning", YELLOW, "WARNING", msg, this.#sinks.out);
  }

  error(msg: string) {
    this.#emit("error", RED, "ERROR", msg, this.#sinks.err);
  }
}

/** LOGLEVEL 環境変数（既定 info）で構成した既定ロガー。 */
export const log: Logger = new Logger(parseLevel(Deno.env.get("LOGLEVEL")));
