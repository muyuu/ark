#!/usr/bin/env bash
# Claude Code の Notification hook。stdin の JSON を読み、OS の通知として出す。
#
# 通知手段が無い環境（WSL / headless / CI 等）では黙って何もしない。通知は補助であって、
# 失敗を報告してもユーザーにできることが無いため。
set -u

input=$(cat)

# JSON パーサを前提にしない（jq が無いマシンでも動かすため）。値に " を含まない前提の簡易抽出。
field() {
  sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" <<<"$input"
}

message=$(field message)
title="Claude Code — $(field notification_type)"

if command -v terminal-notifier >/dev/null 2>&1; then
  # macOS: 通知をクリックしたら呼び出し元のターミナルへ戻れるよう、親アプリを activate 先にする。
  terminal-notifier -title "$title" -message "$message" -sound Ping \
    -activate "${__CFBundleIdentifier:-com.apple.Terminal}"
elif command -v notify-send >/dev/null 2>&1; then
  notify-send "$title" "$message"
fi
