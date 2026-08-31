use crate::proc;

/// PR state for a `pr-<n>` worktree: `gh pr view <n> --json state -q .state`.
pub fn pr_state_by_number(num: &str) -> String {
    proc::capture("gh", ["pr", "view", num, "--json", "state", "-q", ".state"]).unwrap_or_default()
}

/// PR state for a branch: `gh pr list --head <branch> --state all
/// --json state -q '.[0].state // ""'`.
///
/// branch が空のときは gh を呼ばずに空を返す。`--head ""` はフィルタとして効かず、
/// リポジトリの最新 PR の状態が返るため、呼び出し側が無関係な PR の状態を掴んでしまう
/// （箱の掃除で使うと、branch ラベルの無い箱が named volume ごと消える）。
pub fn pr_state_by_branch(branch: &str) -> String {
    if branch.is_empty() {
        return String::new();
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_branch_never_queries_gh() {
        assert_eq!(pr_state_by_branch(""), "");
    }
}
