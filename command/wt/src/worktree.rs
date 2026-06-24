use anyhow::{bail, Result};
use std::fs;
use std::io::{self, BufRead, Write};
use std::os::unix::fs as unixfs;
use std::path::Path;

use crate::env::Env;
use crate::gh;
use crate::proc;
use crate::sandbox;

/// Worktree names (immediate subdirectories of `<repo>.worktrees`), sorted
/// to match zsh glob ordering (`*(/N)` is lexically sorted).
fn worktree_names(env: &Env) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(rd) = fs::read_dir(&env.dir) {
        for entry in rd.flatten() {
            if entry.path().is_dir() {
                if let Some(n) = entry.file_name().to_str() {
                    names.push(n.to_string());
                }
            }
        }
    }
    names.sort();
    names
}

/// Write the VSCode multi-root workspace json (`__wt_update_workspace`).
fn update_workspace(env: &Env) -> Result<()> {
    let mut folders = vec![serde_json::json!({ "path": env.repo })];
    for name in worktree_names(env) {
        folders.push(serde_json::json!({
            "path": format!("{}.worktrees/{}", env.repo, name)
        }));
    }
    let doc = serde_json::json!({ "folders": folders, "settings": {} });
    fs::write(&env.workspace, serde_json::to_string_pretty(&doc)?)?;
    Ok(())
}

/// Add a worktree folder to the running Zed window (`zed --add`). Best-effort:
/// when the Zed CLI isn't on PATH we skip and let the caller fall back to a
/// `wt code` hint. Returns whether Zed was invoked.
fn open_in_zed(wt_path: &str) -> bool {
    if !proc::has_command("zed") {
        return false;
    }
    proc::run("zed", ["--add", wt_path])
}

/// Apply the symlink whitelist (`__wt_apply_symlinks`).
fn apply_symlinks(env: &Env, wt_path: &str) {
    if !Path::new(&env.config).is_file() {
        println!("  (symlink whitelist なし: {})", env.config);
        return;
    }
    let file = match fs::File::open(&env.config) {
        Ok(f) => f,
        Err(_) => {
            println!("  (symlink whitelist なし: {})", env.config);
            return;
        }
    };
    // BufRead::lines() already strips the trailing newline; zsh's
    // `IFS= read -r` keeps the rest verbatim, so we don't trim further.
    for line in io::BufReader::new(file).lines().map_while(Result::ok) {
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let src = format!("{}/{}", env.main, line);
        let dst = format!("{wt_path}/{line}");
        if !Path::new(&src).exists() {
            println!("  ⏭ skip: {line} (main に存在しない)");
            continue;
        }
        if let Some(parent) = Path::new(&dst).parent() {
            let _ = fs::create_dir_all(parent);
        }
        // ln -sfv: replace existing symlink/file at dst.
        let _ = fs::remove_file(&dst);
        match unixfs::symlink(&src, &dst) {
            Ok(_) => println!("  '{dst}' -> '{src}'"),
            Err(e) => eprintln!("wt: symlink 失敗: {dst}: {e}"),
        }
    }
}

/// `__wt_worktree_create`.
pub fn create(env: &Env, branch: &str, name: &str) -> Result<()> {
    let wt_path = format!("{}/{}", env.dir, name);
    if Path::new(&wt_path).exists() {
        bail!("wt: {wt_path} は既に存在する");
    }

    fs::create_dir_all(&env.dir)?;
    let main = env.main.as_str();
    // fetch origin <branch>; ignore failure.
    let _ = proc::run_quiet("git", ["-C", main, "fetch", "origin", branch]);

    let heads_ref = format!("refs/heads/{branch}");
    let local = proc::run_quiet(
        "git",
        [
            "-C",
            main,
            "show-ref",
            "--verify",
            "--quiet",
            heads_ref.as_str(),
        ],
    );
    let remotes_ref = format!("refs/remotes/origin/{branch}");
    let remote = proc::run_quiet(
        "git",
        [
            "-C",
            main,
            "show-ref",
            "--verify",
            "--quiet",
            remotes_ref.as_str(),
        ],
    );

    let origin_branch = format!("origin/{branch}");
    let origin_default = format!("origin/{}", env.default_branch);
    let wt = wt_path.as_str();
    let ok = if local {
        proc::run("git", ["-C", main, "worktree", "add", wt, branch])
    } else if remote {
        proc::run(
            "git",
            [
                "-C",
                main,
                "worktree",
                "add",
                "-b",
                branch,
                wt,
                origin_branch.as_str(),
            ],
        )
    } else {
        proc::run(
            "git",
            [
                "-C",
                main,
                "worktree",
                "add",
                "-b",
                branch,
                wt,
                origin_default.as_str(),
            ],
        )
    };
    if !ok {
        bail!("wt: worktree add 失敗");
    }

    apply_symlinks(env, &wt_path);
    update_workspace(env)?;

    println!("✅ worktree 作成: {wt_path}");
    println!("   cd {wt_path}");
    if open_in_zed(&wt_path) {
        println!("   (Zed に folder を追加した)");
    } else {
        println!("   wt code  # VSCode multi-root workspace を開く");
    }
    Ok(())
}

/// Resolve PR state for a worktree entry (used by list & sweep).
/// `pr-*` names look up by number first, then fall back to branch lookup.
fn entry_pr_state(name: &str, branch: &str) -> String {
    let mut state = String::new();
    if let Some(num) = name.strip_prefix("pr-") {
        state = gh::pr_state_by_number(num);
    }
    if state.is_empty() && !branch.is_empty() && branch != "?" {
        state = gh::pr_state_by_branch(branch);
    }
    state
}

/// `__wt_list` + `__wt_list_boxes`.
pub fn list(env: &Env) {
    if Path::new(&env.dir).is_dir() {
        for name in worktree_names(env) {
            let entry = format!("{}/{}", env.dir, name);
            let branch = proc::capture_in(&entry, "git", ["rev-parse", "--abbrev-ref", "HEAD"])
                .unwrap_or_else(|| "?".to_string());
            let state = entry_pr_state(&name, &branch);
            let state = if state.is_empty() { "no-pr" } else { &state };
            println!("  {name:<24}  {branch:<40}  {state}");
        }
    } else {
        println!("(worktree なし: {})", env.dir);
    }
    sandbox::list_boxes(env);
}

/// `__wt_sweep` + `__wt_sweep_boxes`.
pub fn sweep(env: &Env) -> Result<()> {
    if Path::new(&env.dir).is_dir() {
        let mut to_remove: Vec<String> = Vec::new();
        for name in worktree_names(env) {
            let entry = format!("{}/{}", env.dir, name);
            let branch = proc::capture_in(&entry, "git", ["rev-parse", "--abbrev-ref", "HEAD"])
                .unwrap_or_default();
            // For sweep, pr-* still tries number first then branch (matching zsh,
            // which only does branch fallback when branch is non-empty).
            let mut state = String::new();
            if let Some(num) = name.strip_prefix("pr-") {
                state = gh::pr_state_by_number(num);
            }
            if state.is_empty() && !branch.is_empty() {
                state = gh::pr_state_by_branch(&branch);
            }
            if state == "MERGED" || state == "CLOSED" {
                to_remove.push(entry);
                println!("  {state}: {name}");
            }
        }
        if !to_remove.is_empty() {
            print!("{} 件の worktree を削除しますか? [y/N] ", to_remove.len());
            io::stdout().flush().ok();
            if read_yes() {
                for path in &to_remove {
                    proc::run(
                        "git",
                        [
                            "-C",
                            env.main.as_str(),
                            "worktree",
                            "remove",
                            "--force",
                            path.as_str(),
                        ],
                    );
                    println!("  🗑 {path}");
                }
                update_workspace(env)?;
            } else {
                println!("worktree は中断");
            }
        } else {
            println!("worktree 削除対象なし");
        }
    }
    sandbox::sweep_boxes(env);
    Ok(())
}

/// `__wt_rm`. Box takes precedence; otherwise remove worktree.
pub fn rm(env: &Env, name: &str) -> Result<()> {
    if sandbox::rm_box(env, name) {
        return Ok(());
    }
    let wt_path = format!("{}/{}", env.dir, name);
    let box_name = format!("wtbox-{}-{}", env.repo, name);
    if !Path::new(&wt_path).is_dir() {
        bail!("wt: {wt_path} も箱 {box_name} も存在しない");
    }
    proc::run(
        "git",
        [
            "-C",
            env.main.as_str(),
            "worktree",
            "remove",
            wt_path.as_str(),
        ],
    );
    update_workspace(env)?;
    Ok(())
}

/// `__wt_code`.
pub fn code(env: &Env) -> Result<()> {
    update_workspace(env)?;
    if !proc::has_command("code") {
        eprintln!(
            "wt: 'code' コマンドが見つからない（VSCode の Shell Command Install をしたか？）"
        );
        println!("  workspace ファイル: {}", env.workspace);
        bail!("code not found");
    }
    proc::run("code", [env.workspace.as_str()]);
    Ok(())
}

/// Read a line; treat "y"/"Y" as yes (matching the zsh `[[ $ans == y || Y ]]`).
fn read_yes() -> bool {
    let mut ans = String::new();
    if io::stdin().read_line(&mut ans).is_err() {
        return false;
    }
    let ans = ans.trim();
    ans == "y" || ans == "Y"
}
