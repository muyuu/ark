use anyhow::{bail, Result};
use std::io::{self, Write};
use std::process::{Command, Stdio};

use crate::env::Env;
use crate::gh;
use crate::proc;

/// The bash script run inside the box for clone & setup
/// (`__wt_sandbox_create`). Kept verbatim as a single `bash -lc` string.
const SETUP_SCRIPT: &str = r#"
      set -e
      export PATH="$HOME/.local/bin:$PATH"
      git clone -q /mirror .
      [ -n "$WT_ORIGIN" ]    && git remote set-url origin "$WT_ORIGIN"
      [ -n "$WT_GIT_NAME" ]  && git config user.name  "$WT_GIT_NAME"
      [ -n "$WT_GIT_EMAIL" ] && git config user.email "$WT_GIT_EMAIL"
      if [ -n "$GH_TOKEN" ]; then gh auth setup-git 2>/dev/null || true; git fetch -q origin || true; fi
      if git show-ref --verify --quiet "refs/heads/$WT_BRANCH"; then
        git checkout -q "$WT_BRANCH"
      elif git show-ref --verify --quiet "refs/remotes/origin/$WT_BRANCH"; then
        git checkout -q -b "$WT_BRANCH" "origin/$WT_BRANCH"
      else
        git checkout -q -b "$WT_BRANCH"
      fi
      mise trust >/dev/null 2>&1 || true
      mise install >/dev/null 2>&1 || true
      mise exec -- npm i -g @anthropic-ai/claude-code >/dev/null 2>&1 \
        || npm i -g @anthropic-ai/claude-code >/dev/null 2>&1 || true
    "#;

/// The bash script run on `wt enter` (`__wt_enter`).
const ENTER_SCRIPT: &str = r#"export PATH="$HOME/.local/bin:$PATH"; [ -n "$GH_TOKEN" ] && gh auth setup-git 2>/dev/null; exec mise exec -- claude"#;

/// Normalize an origin url to https (`__wt_to_https`).
fn to_https(u: &str) -> String {
    if let Some(rest) = u.strip_prefix("git@github.com:") {
        format!("https://github.com/{rest}")
    } else if let Some(rest) = u.strip_prefix("ssh://git@github.com/") {
        format!("https://github.com/{rest}")
    } else {
        u.to_string()
    }
}

/// Whether docker is installed and `docker info` succeeds.
fn docker_running() -> bool {
    proc::has_command("docker") && proc::run_quiet("docker", ["info"])
}

/// Whether a container with the exact name exists (`docker ps -a` + grep -qx).
fn container_exists(name: &str) -> bool {
    if !proc::has_command("docker") {
        return false;
    }
    let out = proc::capture("docker", ["ps", "-a", "--format", "{{.Names}}"]).unwrap_or_default();
    out.lines().any(|l| l == name)
}

/// Fetch GH token from Bitwarden when `bw` exists and `$BW_SESSION` is set.
fn gh_token(repo: &str) -> String {
    let bw_session = std::env::var("BW_SESSION").unwrap_or_default();
    if proc::has_command("bw") && !bw_session.is_empty() {
        let item = format!("agent-sandbox/{repo}");
        proc::capture("bw", ["get", "password", item.as_str()]).unwrap_or_default()
    } else {
        String::new()
    }
}

/// devcontainer CLI wrapped through a fixed node via mise (`__wt_dc`).
fn dc_build(env: &Env, img: &str) -> bool {
    let node = std::env::var("WT_SANDBOX_NODE").unwrap_or_else(|_| "lts".to_string());
    let node_arg = format!("node@{node}");
    Command::new("mise")
        .args([
            "x",
            node_arg.as_str(),
            "--",
            "devcontainer",
            "build",
            "--workspace-folder",
            env.main.as_str(),
            "--image-name",
            img,
        ])
        .stdout(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// `__wt_sandbox_create`.
pub fn create(env: &Env, branch: &str, name: &str) -> Result<()> {
    if !docker_running() {
        bail!("wt: docker が動いていない（Docker を起動して再実行）");
    }
    let box_name = format!("wtbox-{}-{}", env.repo, name);
    let img = format!("wt-sandbox-{}", env.repo);
    let wsdir = format!("/workspaces/{}", env.repo);
    if container_exists(&box_name) {
        bail!("wt: 箱 {box_name} は既に存在する（wt enter {name} で入る / wt rm {name} で削除）");
    }
    let origin_raw =
        proc::capture_in(&env.main, "git", ["remote", "get-url", "origin"]).unwrap_or_default();
    let origin_url = to_https(&origin_raw);

    println!("▶ image をビルド（.devcontainer から・キャッシュ利用）...");
    if !dc_build(env, &img) {
        bail!("wt: image ビルド失敗");
    }

    println!("▶ 箱を起動（named volume を workspace に・ホストはミラー ro）...");
    let label_repo = format!("wt.repo={}", env.repo);
    let label_branch = format!("wt.branch={branch}");
    let vol_arg = format!("{box_name}:{wsdir}");
    let mirror_arg = format!("{}:/mirror:ro", env.main);
    let run_ok = proc::run_quiet(
        "docker",
        [
            "run",
            "-d",
            "--name",
            box_name.as_str(),
            "--label",
            label_repo.as_str(),
            "--label",
            label_branch.as_str(),
            "-v",
            vol_arg.as_str(),
            "-v",
            mirror_arg.as_str(),
            img.as_str(),
            "sleep",
            "infinity",
        ],
    );
    if !run_ok {
        bail!("wt: コンテナ起動失敗");
    }
    proc::run(
        "docker",
        [
            "exec",
            "-u",
            "root",
            box_name.as_str(),
            "chown",
            "-R",
            "vscode:vscode",
            wsdir.as_str(),
        ],
    );

    let token = gh_token(&env.repo);
    let git_name = proc::capture_in(&env.main, "git", ["config", "user.name"]).unwrap_or_default();
    let git_email =
        proc::capture_in(&env.main, "git", ["config", "user.email"]).unwrap_or_default();

    println!("▶ 箱の中で独立 clone & セットアップ...");
    let e_branch = format!("WT_BRANCH={branch}");
    let e_origin = format!("WT_ORIGIN={origin_url}");
    let e_name = format!("WT_GIT_NAME={git_name}");
    let e_email = format!("WT_GIT_EMAIL={git_email}");
    let e_token = format!("GH_TOKEN={token}");
    let setup_ok = Command::new("docker")
        .args([
            "exec",
            "-u",
            "vscode",
            "-w",
            wsdir.as_str(),
            "-e",
            e_branch.as_str(),
            "-e",
            e_origin.as_str(),
            "-e",
            e_name.as_str(),
            "-e",
            e_email.as_str(),
            "-e",
            e_token.as_str(),
            box_name.as_str(),
            "bash",
            "-lc",
            SETUP_SCRIPT,
        ])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !setup_ok {
        bail!("wt: 箱内セットアップ失敗");
    }

    println!("✅ 箱作成: {box_name}  (branch: {branch})");
    if token.is_empty() {
        println!(
            "   ⚠ GH_TOKEN 未注入（bw を unlock してから wt enter、または箱内で gh auth login）"
        );
    }
    println!("   wt enter {name}   # 箱に入って claude を起動");
    Ok(())
}

/// `__wt_enter` — attaches an interactive TTY (inherits stdio).
pub fn enter(env: &Env, name: &str) -> Result<()> {
    if name.is_empty() {
        bail!("wt: 'wt enter <name>'");
    }
    let box_name = format!("wtbox-{}-{}", env.repo, name);
    let wsdir = format!("/workspaces/{}", env.repo);
    if !container_exists(&box_name) {
        bail!("wt: 箱 {box_name} が無い（wt sandbox {name} で作成）");
    }
    proc::run_quiet("docker", ["start", box_name.as_str()]);
    let token = gh_token(&env.repo);

    // Interactive: inherit stdio so the TTY attaches.
    let e_token = format!("GH_TOKEN={token}");
    let status = Command::new("docker")
        .args([
            "exec",
            "-it",
            "-u",
            "vscode",
            "-w",
            wsdir.as_str(),
            "-e",
            e_token.as_str(),
            box_name.as_str(),
            "bash",
            "-lc",
            ENTER_SCRIPT,
        ])
        .status();
    match status {
        Ok(_) => Ok(()),
        Err(e) => bail!("wt: docker exec 失敗: {e}"),
    }
}

/// `__wt_list_boxes`.
pub fn list_boxes(env: &Env) {
    if !proc::has_command("docker") {
        return;
    }
    let filter = format!("label=wt.repo={}", env.repo);
    let out = proc::capture(
        "docker",
        [
            "ps",
            "-a",
            "--filter",
            filter.as_str(),
            "--format",
            "{{.Names}}|{{.Label \"wt.branch\"}}|{{.Status}}",
        ],
    )
    .unwrap_or_default();
    if out.is_empty() {
        return;
    }
    println!("  -- 箱 (sandbox) --");
    let prefix = format!("wtbox-{}-", env.repo);
    for line in out.lines() {
        if line.is_empty() {
            continue;
        }
        let mut parts = line.splitn(3, '|');
        let bname = parts.next().unwrap_or("");
        let branch = parts.next().unwrap_or("");
        let st = parts.next().unwrap_or("");
        if bname.is_empty() {
            continue;
        }
        let nm = bname.strip_prefix(&prefix).unwrap_or(bname);
        let mut pr_state = gh::pr_state_by_branch(branch);
        if pr_state.is_empty() {
            pr_state = "no-pr".to_string();
        }
        println!("  {nm:<24}  {branch:<30}  {pr_state:<10}  {st}");
    }
}

/// `__wt_sweep_boxes`.
pub fn sweep_boxes(env: &Env) {
    if !proc::has_command("docker") {
        return;
    }
    let filter = format!("label=wt.repo={}", env.repo);
    let out = proc::capture(
        "docker",
        [
            "ps",
            "-a",
            "--filter",
            filter.as_str(),
            "--format",
            "{{.Names}}|{{.Label \"wt.branch\"}}",
        ],
    )
    .unwrap_or_default();
    if out.is_empty() {
        return;
    }
    let mut rm_boxes: Vec<String> = Vec::new();
    for line in out.lines() {
        if line.is_empty() {
            continue;
        }
        let mut parts = line.splitn(2, '|');
        let bname = parts.next().unwrap_or("");
        let branch = parts.next().unwrap_or("");
        if bname.is_empty() {
            continue;
        }
        let state = gh::pr_state_by_branch(branch);
        if state == "MERGED" || state == "CLOSED" {
            rm_boxes.push(bname.to_string());
            println!("  {state}: 箱 {bname} ({branch})");
        }
    }
    if rm_boxes.is_empty() {
        println!("箱 削除対象なし");
        return;
    }
    print!("{} 個の箱を削除しますか? [y/N] ", rm_boxes.len());
    io::stdout().flush().ok();
    let mut ans = String::new();
    if io::stdin().read_line(&mut ans).is_err() {
        return;
    }
    let ans = ans.trim();
    if ans != "y" && ans != "Y" {
        println!("箱は中断");
        return;
    }
    for b in &rm_boxes {
        proc::run_quiet("docker", ["rm", "-f", b.as_str()]);
        proc::run_quiet("docker", ["volume", "rm", b.as_str()]);
        println!("  🗑 箱 {b}");
    }
}

/// Remove a box if its container exists (`__wt_rm` box branch).
/// Returns true if a box was found & removed.
pub fn rm_box(env: &Env, name: &str) -> bool {
    let box_name = format!("wtbox-{}-{}", env.repo, name);
    if proc::has_command("docker") && container_exists(&box_name) {
        proc::run_quiet("docker", ["rm", "-f", box_name.as_str()]);
        proc::run_quiet("docker", ["volume", "rm", box_name.as_str()]);
        println!("🗑 箱 {box_name} を削除");
        true
    } else {
        false
    }
}
