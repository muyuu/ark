# 唯一の Windows shell 入口。winget で toolchain（git / mise / deno）を用意し、以降のロジックは
# engine/ の TypeScript（Deno）へ委譲する。mac/Linux の bootstrap.sh と同型・薄い範囲。
#
# 使い方:
#   irm https://raw.githubusercontent.com/muyuu/ark/main/bootstrap.ps1 | iex
#   （clone 済みなら）.\bootstrap.ps1

$ErrorActionPreference = "Stop"

# winget でインストールした直後はプロセスの PATH に乗らないため、Machine/User から読み直す
function Update-ProcessPath {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function Install-IfMissing($command, $wingetId, $name) {
    if (Get-Command $command -ErrorAction SilentlyContinue) { return }
    Write-Host "📦 $name をインストールします..." -ForegroundColor Yellow
    winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
    Update-ProcessPath
}

# リポジトリの場所: clone 済みならスクリプト位置、未取得（irm | iex 経由）なら既定パスへ
if ($PSScriptRoot) {
    $arkDir = $PSScriptRoot
} else {
    $arkDir = Join-Path $env:USERPROFILE "workspaces\github.com\muyuu\ark"
}

# Git（clone に必要）
Install-IfMissing "git" "Git.Git" "Git"

if (-not (Test-Path (Join-Path $arkDir ".git"))) {
    Write-Host "📦 ark リポジトリをクローンします..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path (Split-Path -Parent $arkDir) -Force | Out-Null
    git clone https://github.com/muyuu/ark.git $arkDir
}

Set-Location $arkDir

# mise
Install-IfMissing "mise" "jdx.mise" "mise"

# リポジトリの mise 設定を信頼し、deno を用意する（Windows は command をビルドしないため rust は入れない）
mise trust "$arkDir\mise.toml" 2>$null
Write-Host "🦕 deno を用意しています..." -ForegroundColor Cyan
mise install deno

# private overlay を使う場合だけ、GitHub 認証と SSH 鍵を用意してから取得する
$overlaysToml = Join-Path $env:USERPROFILE ".config\ark\overlays.toml"
if (Test-Path $overlaysToml) {
    Install-IfMissing "gh" "GitHub.cli" "GitHub CLI"
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "▶ GitHub にログインします（ブラウザ認証）..." -ForegroundColor Cyan
        gh auth login --git-protocol ssh --web
    }
    Write-Host "🔑 SSH 鍵を用意しています..." -ForegroundColor Cyan
    mise exec deno -- deno run -A "$arkDir\engine\setup-github.ts"
    Write-Host "▶ overlay を取得しています..." -ForegroundColor Cyan
    mise exec deno -- deno run -A "$arkDir\engine\overlay-sync.ts"
}

# 環境設定（dotfiles）→ パッケージ導入（winget）まで同一実行で完了させる
Write-Host "▶ 環境を設定しています（dotfiles）..." -ForegroundColor Cyan
mise exec deno -- deno run -A "$arkDir\engine\bootstrap.ts"

Write-Host "▶ パッケージを導入しています..." -ForegroundColor Cyan
mise exec deno -- deno run -A "$arkDir\engine\install.ts"

Write-Host "✅ セットアップ完了。" -ForegroundColor Green
Write-Host "   GUI アプリ（machine スコープ）は管理者権限が要る場合があります。その時は管理者 PowerShell でリポジトリ直下から 'mise run install' を再実行してください。" -ForegroundColor Gray
Write-Host "   dotfiles の symlink には開発者モード（または管理者）が必要です。" -ForegroundColor Gray
