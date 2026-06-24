use crate::proc;

/// PR state for a `pr-<n>` worktree: `gh pr view <n> --json state -q .state`.
pub fn pr_state_by_number(num: &str) -> String {
    proc::capture("gh", ["pr", "view", num, "--json", "state", "-q", ".state"]).unwrap_or_default()
}

/// PR state for a branch: `gh pr list --head <branch> --state all
/// --json state -q '.[0].state // ""'`.
pub fn pr_state_by_branch(branch: &str) -> String {
    proc::capture(
        "gh",
        [
            "pr",
            "list",
            "--head",
            branch,
            "--state",
            "all",
            "--json",
            "state",
            "-q",
            ".[0].state // \"\"",
        ],
    )
    .unwrap_or_default()
}

/// headRefName of a PR number: `gh pr view <n> --json headRefName
/// -q .headRefName`.
pub fn pr_head_ref(num: &str) -> String {
    proc::capture(
        "gh",
        [
            "pr",
            "view",
            num,
            "--json",
            "headRefName",
            "-q",
            ".headRefName",
        ],
    )
    .unwrap_or_default()
}
