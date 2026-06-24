use std::ffi::OsStr;
use std::process::{Command, Stdio};

/// Run a command, capturing stdout. Returns trimmed stdout on success
/// (exit code 0), otherwise `None`. Stderr is discarded. Mirrors the
/// `$(cmd 2>/dev/null)` idiom used throughout the zsh.
pub fn capture<I, S>(program: &str, args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let out = Command::new(program)
        .args(args)
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Like `capture` but allows setting the working directory.
pub fn capture_in<I, S>(dir: &str, program: &str, args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let out = Command::new(program)
        .current_dir(dir)
        .args(args)
        .stderr(Stdio::null())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Run a command inheriting stdout/stderr; return whether it succeeded.
pub fn run<I, S>(program: &str, args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    Command::new(program)
        .args(args)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Run a command silencing both stdout and stderr; return whether it
/// succeeded. Mirrors `cmd >/dev/null 2>&1`.
pub fn run_quiet<I, S>(program: &str, args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    Command::new(program)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Whether an executable is resolvable on PATH (`command -v`).
pub fn has_command(name: &str) -> bool {
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            if dir.is_empty() {
                continue;
            }
            let candidate = std::path::Path::new(dir).join(name);
            if let Ok(meta) = std::fs::metadata(&candidate) {
                if meta.is_file() {
                    return true;
                }
            }
        }
    }
    false
}
