mod env;
mod gh;
mod proc;
mod sandbox;
mod worktree;

use std::path::Path;
use std::process::ExitCode;

use clap::Parser;

use crate::env::Env;

/// wt: git worktree + sandbox manager (Rust port).
///
/// Arguments are intentionally captured raw and dispatched manually so the
/// flag/positional handling matches the original zsh exactly.
#[derive(Parser)]
#[command(name = "wt", disable_help_flag = true, disable_help_subcommand = true)]
struct Cli {
    #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
    args: Vec<String>,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let mut args = cli.args;
    let cmd = if args.is_empty() {
        "help".to_string()
    } else {
        args.remove(0)
    };

    if let Some(help) = subcommand_help(&cmd) {
        if wants_help(&args) {
            print!("{help}");
            return ExitCode::SUCCESS;
        }
    }

    let result: anyhow::Result<()> = match cmd.as_str() {
        "new" => with_env(|e| cmd_new(&e, &args, SandboxMode::Auto)),
        "sandbox" => with_env(|e| cmd_new(&e, &args, SandboxMode::On)),
        "enter" => with_env(|e| sandbox::enter(&e, name_arg(&args, "入る箱の名前")?)),
        "sync" => with_env(|e| sandbox::sync(&e, name_arg(&args, "取り込む箱の名前")?)),
        "list" | "ls" => with_env(|e| {
            worktree::list(&e);
            Ok(())
        }),
        "sweep" => with_env(|e| worktree::sweep(&e)),
        "rm" => with_env(|e| cmd_rm(&e, &args)),
        "code" => with_env(|e| worktree::code(&e)),
        "help" | "--help" | "-h" => {
            print_help();
            Ok(())
        }
        other => {
            eprintln!("wt: 不明なサブコマンド: {other}");
            print_help();
            return ExitCode::FAILURE;
        }
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}

/// Initialize the env (like `__wt_init_env`) then run `f`. If env detection
/// fails the error is propagated (and printed by `main`).
fn with_env<F>(f: F) -> anyhow::Result<()>
where
    F: FnOnce(Env) -> anyhow::Result<()>,
{
    let env = Env::detect()?;
    f(env)
}

enum SandboxMode {
    Auto,
    On,
}

/// `--help` / `-h` がどこかに含まれていれば true。
fn wants_help(args: &[String]) -> bool {
    args.iter().any(|a| a == "--help" || a == "-h")
}

/// 位置引数に `-` 始まりを許さない。`wt new --foo` の `--foo` がブランチ名として
/// git に渡り `git worktree add` が走るのを防ぐ。
fn positional(arg: &str) -> anyhow::Result<&str> {
    if arg.starts_with('-') {
        anyhow::bail!("wt: 不明なオプション: {arg}（ヘルプは --help）");
    }
    Ok(arg)
}

fn name_arg<'a>(args: &'a [String], what: &str) -> anyhow::Result<&'a str> {
    match args.first() {
        Some(a) => positional(a),
        None => anyhow::bail!("wt: {what}を指定"),
    }
}

#[derive(Debug, PartialEq)]
enum NewTarget {
    Branch(String),
    Pr(String),
}

struct NewArgs {
    target: NewTarget,
    name: String,
    sandbox: SandboxModeState,
}

/// `wt new` / `wt sandbox` の引数を解釈する。`--sandbox` / `--no-sandbox` 以外の
/// `-` 始まりはエラー。
fn parse_new(args: &[String], base_mode: SandboxMode) -> anyhow::Result<NewArgs> {
    let mut sandbox = match base_mode {
        SandboxMode::On => SandboxModeState::On,
        SandboxMode::Auto => SandboxModeState::Auto,
    };
    let mut rest: Vec<&str> = Vec::new();
    for a in args {
        match a.as_str() {
            "--sandbox" => sandbox = SandboxModeState::On,
            "--no-sandbox" => sandbox = SandboxModeState::Off,
            other => rest.push(positional(other)?),
        }
    }

    let (target, name) = if rest.first() == Some(&"pr") {
        let pr_num = rest.get(1).copied().unwrap_or("");
        if pr_num.is_empty() {
            anyhow::bail!("wt: PR 番号を指定 (例: wt new pr 123)");
        }
        (NewTarget::Pr(pr_num.to_string()), format!("pr-{pr_num}"))
    } else {
        let branch = rest.first().copied().unwrap_or("");
        if branch.is_empty() {
            anyhow::bail!("wt: 'wt new <branch>' または 'wt new pr <番号>'");
        }
        let name = rest
            .get(1)
            .map(|s| s.to_string())
            .unwrap_or_else(|| branch.replace('/', "-"));
        (NewTarget::Branch(branch.to_string()), name)
    };

    Ok(NewArgs {
        target,
        name,
        sandbox,
    })
}

/// `__wt_new`: parse branch/name, decide box.
fn cmd_new(env: &Env, args: &[String], base_mode: SandboxMode) -> anyhow::Result<()> {
    let NewArgs {
        target,
        name,
        sandbox,
    } = parse_new(args, base_mode)?;

    let branch = match target {
        NewTarget::Branch(b) => b,
        NewTarget::Pr(pr_num) => {
            let b = gh::pr_head_ref(&pr_num);
            if b.is_empty() {
                anyhow::bail!("wt: PR #{pr_num} の情報取得に失敗（gh auth は通っている?）");
            }
            b
        }
    };

    let use_box = match sandbox {
        SandboxModeState::On => true,
        SandboxModeState::Off => false,
        SandboxModeState::Auto => Path::new(&format!("{}/.devcontainer", env.main)).is_dir(),
    };

    if use_box {
        sandbox::create(env, &branch, &name)
    } else {
        worktree::create(env, &branch, &name)
    }
}

enum SandboxModeState {
    Auto,
    On,
    Off,
}

fn cmd_rm(env: &Env, args: &[String]) -> anyhow::Result<()> {
    worktree::rm(env, name_arg(args, "削除する名前")?)
}

fn subcommand_help(cmd: &str) -> Option<&'static str> {
    Some(match cmd {
        "new" => {
            "使い方: wt new [--sandbox|--no-sandbox] <branch> [<name>]
       wt new [--sandbox|--no-sandbox] pr <番号>

既存ブランチ（local / origin）から worktree を作る。<name> を省くと branch の '/' を '-' に
した名前になる。'pr <番号>' は PR の head branch を fetch して pr-<番号> を作る。
対象リポに .devcontainer があると箱モードになる（--sandbox / --no-sandbox で上書き）。

例:
  wt new feat/login            → <repo>.worktrees/feat-login/
  wt new feat/login login      → <repo>.worktrees/login/
  wt new pr 123                → <repo>.worktrees/pr-123/
"
        }
        "sandbox" => {
            "使い方: wt sandbox <branch> [<name>]
       wt sandbox pr <番号>

隔離箱（devcontainer + named volume へ独立 clone）を明示的に作る。引数は wt new と同じ。

例:
  wt sandbox feat/login
"
        }
        "enter" => {
            "使い方: wt enter <name>

箱に入って claude を起動する。<name> は wt list に出る箱の名前。
"
        }
        "sync" => {
            "使い方: wt sync <name>

箱の作業をホストへ取り込む（host←box の read-only fetch・Tower で見える）。
"
        }
        "list" | "ls" => {
            "使い方: wt list

worktree / 箱 の一覧を PR ステータス付きで出す。
"
        }
        "sweep" => {
            "使い方: wt sweep

merged / closed PR の worktree・箱 を一括削除する（確認あり）。
"
        }
        "rm" => {
            "使い方: wt rm <name>

特定の worktree / 箱 を削除する。<name> は wt list に出る名前。
"
        }
        "code" => {
            "使い方: wt code

VSCode の multi-root workspace（<repo>.code-workspace）を開く。
"
        }
        _ => return None,
    })
}

fn print_help() {
    print!(
        r#"wt: git worktree 管理ツール

サブコマンド:
  wt new <branch>        worktree 作成（.devcontainer があれば箱モード・--no-sandbox で抑止）
  wt new pr <number>     PR の branch を fetch して worktree/箱 作成
  wt sandbox <branch>    隔離箱を作成（devcontainer + named volume へ独立 clone）
  wt enter <name>        箱に入って claude を起動
  wt sync <name>         箱の作業をホストへ取り込む（host←box の read-only fetch・Tower で見える）
  wt list                worktree / 箱 一覧（PR ステータス付き）
  wt sweep               merged/closed PR の worktree・箱 を一括削除（確認あり）
  wt rm <name>           特定 worktree/箱 を削除
  wt code                VSCode の multi-root workspace を開く

各サブコマンドの詳細は `wt <サブコマンド> --help`。

レイアウト:
  <parent>/<repo>/                       メインチェックアウト
  <parent>/<repo>.worktrees/<name>/      worktree 群（sibling 配置）
  <parent>/<repo>.code-workspace         VSCode multi-root workspace

箱モード（sandbox）:
  対象リポに .devcontainer があると wt new は箱モードになる（--sandbox/--no-sandbox で上書き）。
  箱はホストの鍵・home・他リポを見られない。GitHub は Bitwarden の agent-sandbox/<repo> から
  PAT を注入（bw を unlock しておく）、claude は箱の中で起動する。

プロジェクト固有の symlink ホワイトリスト（worktree モードのみ）:
  ~/.config/wt/<repo>.symlinks
    1 行 1 ファイル（main からの相対パス）、空行と # コメント無視。

  例（myapp.symlinks）:
    .env
    .env.local
    .npmrc
"#
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn new_branch_defaults_name_from_branch() {
        let p = parse_new(&args(&["feat/x"]), SandboxMode::Auto).unwrap();
        assert_eq!(p.target, NewTarget::Branch("feat/x".into()));
        assert_eq!(p.name, "feat-x");
    }

    #[test]
    fn new_pr_takes_number() {
        let p = parse_new(&args(&["pr", "123"]), SandboxMode::Auto).unwrap();
        assert_eq!(p.target, NewTarget::Pr("123".into()));
        assert_eq!(p.name, "pr-123");
    }

    #[test]
    fn new_rejects_unknown_option_as_branch() {
        for a in ["--help", "-h", "--foo"] {
            assert!(parse_new(&args(&[a]), SandboxMode::Auto).is_err(), "{a}");
        }
    }

    #[test]
    fn new_sandbox_flags_still_work() {
        let p = parse_new(&args(&["--no-sandbox", "feat/x"]), SandboxMode::On).unwrap();
        assert!(matches!(p.sandbox, SandboxModeState::Off));
    }

    #[test]
    fn help_requested_detects_flag_anywhere() {
        assert!(wants_help(&args(&["--help"])));
        assert!(wants_help(&args(&["pr", "-h"])));
        assert!(!wants_help(&args(&["feat/x"])));
    }

    #[test]
    fn every_subcommand_has_help() {
        for c in [
            "new", "sandbox", "enter", "sync", "list", "ls", "sweep", "rm", "code",
        ] {
            assert!(subcommand_help(c).is_some(), "{c}");
        }
        assert!(subcommand_help("nope").is_none());
    }
}
