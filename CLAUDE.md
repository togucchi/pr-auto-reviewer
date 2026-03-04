# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PR Auto-Reviewer: GitHub PRのレビューリクエストを自動ポーリングし、Claude CLIのpr-review-reportスキルを使ってHTMLレビューレポートを生成するTUIツール。

## Commands

```bash
npm start          # アプリ起動（node src/index.js）
npm install        # 依存関係インストール
```

テストフレームワーク・リンター・ビルドステップは未導入。

## Prerequisites

- Node.js >= 18
- GitHub CLI (`gh`) — 認証済みであること
- Claude Code CLI (`claude`) — インストール済みであること

## Architecture

ES Modules（`"type": "module"`）で構成されたNode.jsアプリ。UIはReact + Ink（CLI向けReactレンダラー）。

### データフロー

1. **Preflight** (`index.js`): `gh`/`claude` CLIの存在・認証を確認、`review-reports/`ディレクトリ作成
2. **Polling** (`services/github-poller.js`): 60秒間隔で `gh api search/issues` を実行し、自分宛のレビューリクエストを検索
3. **Queue & Review** (`services/claude-runner.js`): 新規PRをキューに追加、最大2並列でClaude CLIプロセスを起動しpr-review-reportスキルを実行
4. **State Management** (`store.js`): EventEmitterベースの状態管理。PRステータスは queued → reviewing → completed/failed
5. **Output**: HTMLレポートを `./review-reports/pr-{number}-{date}.html` に保存
6. **Notification** (`services/notifier.js`): macOSデスクトップ通知

### 主要モジュール

- `src/index.js` — エントリポイント（preflight + Inkレンダリング）
- `src/app.js` — ルートReactコンポーネント（ポーリング制御、キーバインド：q=終了, r=更新, space=リトライ）
- `src/config.js` — 設定定数（ポーリング間隔、タイムアウト、並列数等）
- `src/store.js` — EventEmitterベースの状態管理
- `src/components/` — Inkコンポーネント（header, pr-list, log-panel）
- `src/services/` — ポーリング、レビュー実行、通知

### スキル定義

`.claude/skills/pr-review-report/` にPRレビューレポート生成スキルが定義されている。レポートテンプレートは `assets/report-template.html`。

## Key Configuration

- ポーリング間隔: 60秒 (`POLL_INTERVAL_MS`)
- 最大並列レビュー: 2 (`MAX_CONCURRENT_REVIEWS`)
- Claudeタイムアウト: 10分 (`CLAUDE_TIMEOUT_MS`)
- レビュー済みPR記録: `.reviewed-prs.json`（gitignore対象）
- レポート出力先: `review-reports/`（gitignore対象）
