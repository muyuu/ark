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

    let result: anyhow::Result<()> = match cmd.as_str() {
        "new" => with_env(|e| cmd_new(&e, &args, SandboxMode::Auto)),
        "sandbox" => with_env(|e| cmd_new(&e, &args, SandboxMode::On)),
        "enter" => with_env(|e| sandbox::enter(&e, args.first().map(|s| s.as_str()).unwrap_or(""))),
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

/// `__wt_new`: strip --sandbox/--no-sandbox, parse branch/name, decide box.
fn cmd_new(env: &Env, args: &[String], base_mode: SandboxMode) -> anyhow::Result<()> {
    // base_mode::On corresponds to the `sandbox` subcommand which calls
    // `__wt_new --sandbox "$@"`, i.e. an extra leading --sandbox.
    let mut mode = match base_mode {
        SandboxMode::On => SandboxModeState::On,
        SandboxMode::Auto => SandboxModeState::Auto,
    };
    let mut rest: Vec<&str> = Vec::new();
    for a in args {
        match a.as_str() {
            "--sandbox" => mode = SandboxModeState::On,
            "--no-sandbox" => mode = SandboxModeState::Off,
            other => rest.push(other),
        }
    }

    let (branch, name): (String, String);
    if rest.first() == Some(&"pr") {
        let pr_num = rest.get(1).copied().unwrap_or("");
        if pr_num.is_empty() {
            anyhow::bail!("wt: PR 番号を指定 (例: wt new pr 123)");
        }
        let b = gh::pr_head_ref(pr_num);
        if b.is_empty() {
            anyhow::bail!("wt: PR #{pr_num} の情報取得に失敗（gh auth は通っている?）");
        }
        branch = b;
        name = format!("pr-{pr_num}");
    } else {
        let b = rest.first().copied().unwrap_or("");
        if b.is_empty() {
            anyhow::bail!("wt: 'wt new <branch>' または 'wt new pr <番号>'");
        }
        branch = b.to_string();
        name = rest
            .get(1)
            .map(|s| s.to_string())
            .unwrap_or_else(|| branch.replace('/', "-"));
    }

    let use_box = match mode {
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
    let name = args.first().map(|s| s.as_str()).unwrap_or("");
    if name.is_empty() {
        anyhow::bail!("wt: 削除する名前を指定");
    }
    worktree::rm(env, name)
}

fn print_help() {
    print!(
        r#"wt: git worktree 管理ツール

サブコマンド:
  wt new <branch>        worktree 作成（.devcontainer があれば箱モード・--no-sandbox で抑止）
  wt new pr <number>     PR の branch を fetch して worktree/箱 作成
  wt sandbox <branch>    隔離箱を作成（devcontainer + named volume へ独立 clone）
  wt enter <name>        箱に入って claude を起動
  wt list                worktree / 箱 一覧（PR ステータス付き）
  wt sweep               merged/closed PR の worktree・箱 を一括削除（確認あり）
  wt rm <name>           特定 worktree/箱 を削除
  wt code                VSCode の multi-root workspace を開く

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
