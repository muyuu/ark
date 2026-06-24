use anyhow::{bail, Result};
use std::path::Path;

use crate::proc;

/// Resolved environment for the repo containing the current working directory.
///
/// Mirrors `__wt_init_env`. All paths are absolute strings (kept as `String`
/// to match the shell's textual handling).
pub struct Env {
    /// Main worktree (checkout) path: first `worktree` line of
    /// `git worktree list --porcelain`.
    pub main: String,
    /// Repo basename (the directory name of the main checkout).
    pub repo: String,
    /// `<parent>/<repo>.worktrees`
    pub dir: String,
    /// `<parent>/<repo>.code-workspace`
    pub workspace: String,
    /// `~/.config/wt/<repo>.symlinks`
    pub config: String,
    /// default branch for new-branch base point (short name, no `origin/`).
    pub default_branch: String,
}

impl Env {
    pub fn detect() -> Result<Env> {
        let porcelain = proc::capture("git", ["worktree", "list", "--porcelain"]);
        let main = porcelain
            .as_deref()
            .and_then(first_worktree_path)
            .unwrap_or_default();
        if main.is_empty() {
            bail!("wt: 現在地が git リポジトリ内ではない");
        }

        let parent = Path::new(&main)
            .parent()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| ".".to_string());
        let repo = Path::new(&main)
            .file_name()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();
        let dir = format!("{parent}/{repo}.worktrees");
        let workspace = format!("{parent}/{repo}.code-workspace");
        let home = std::env::var("HOME").unwrap_or_default();
        let config = format!("{home}/.config/wt/{repo}.symlinks");

        let default_branch = detect_default_branch(&main);

        Ok(Env {
            main,
            repo,
            dir,
            workspace,
            config,
            default_branch,
        })
    }
}

/// Parse the first `worktree <path>` line from porcelain output.
fn first_worktree_path(porcelain: &str) -> Option<String> {
    for line in porcelain.lines() {
        if let Some(rest) = line.strip_prefix("worktree ") {
            let p = rest.trim();
            if !p.is_empty() {
                return Some(p.to_string());
            }
        }
    }
    None
}

/// origin/HEAD short → strip `origin/`; fallback origin/master then main.
fn detect_default_branch(main: &str) -> String {
    let mut b = proc::capture_in(
        main,
        "git",
        ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    )
    .unwrap_or_default();
    if let Some(stripped) = b.strip_prefix("origin/") {
        b = stripped.to_string();
    }
    if b.is_empty() {
        if proc::run_quiet(
            "git",
            [
                "-C",
                main,
                "show-ref",
                "--verify",
                "--quiet",
                "refs/remotes/origin/master",
            ],
        ) {
            return "master".to_string();
        }
        return "main".to_string();
    }
    b
}
