# PR Auto-Reviewer

GitHubでレビュアーに設定されたPRを自動検知し、[Claude Code](https://docs.anthropic.com/en/docs/claude-code) を使ってHTMLレビューレポートを自動生成するTUIツール。

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-blue)

```
┌──────────────────────────────────────────────────────┐
│  PR Auto-Reviewer       Polling: ● 60s  Last: 14:32 │
├──────────────────────────────────────────────────────┤
│  Review Requests                                     │
│  ⠋ reviewing  org/repo#123  OAuth2認証の実装         │
│  ✓ completed  org/sub#456   共通ライブラリ更新       │
│  ○ queued     org/app#789   APIエンドポイント追加    │
│  ✗ failed     org/web#101   UIリファクタリング       │
├──────────────────────────────────────────────────────┤
│  Activity Log                                        │
│  [14:32:05] Polling... found 2 new review requests   │
│  [14:32:06] Starting review: org/repo#123            │
│  [14:33:45] Review complete: pr-123-20260304.html    │
├──────────────────────────────────────────────────────┤
│  [q] quit  [r] refresh now  [space] retry failed     │
└──────────────────────────────────────────────────────┘
```

## 特徴

- **自動検知**: GitHub全リポジトリから自分宛のレビュー依頼を60秒間隔でポーリング
- **自動レビュー**: Claude Codeのpr-review-reportスキルを使い、設計・品質・パフォーマンスの3観点でレビュー
- **HTMLレポート**: Mermaid図・シンタックスハイライト付きの単一HTMLファイルとして出力
- **デスクトップ通知**: レビュー完了・失敗時にmacOSネイティブ通知
- **並列処理**: 最大2件のレビューを同時実行（キュー管理付き）
- **TUI**: Ink (React for CLI) によるリアルタイム表示

## 前提条件

- **Node.js** >= 18
- **GitHub CLI (`gh`)**: インストール済み・認証済みであること
- **Claude Code (`claude`)**: インストール済みであること

```bash
# GitHub CLI のインストール・認証
brew install gh
gh auth login

# Claude Code のインストール
npm install -g @anthropic-ai/claude-code
```

## インストール

```bash
git clone https://github.com/your-username/pr-auto-reviewer.git
cd pr-auto-reviewer
npm install
```

## 使い方

```bash
npm start
```

起動すると自動的にポーリングが始まり、自分宛のレビュー依頼を検知してレビューを開始します。

### キーバインド

| キー | 動作 |
|------|------|
| `q` | 終了 |
| `r` | 即時ポーリング |
| `Space` | 失敗したレビューを再試行 |

### レポート出力先

生成されたHTMLレポートは `./review-reports/` ディレクトリに保存されます。

```
review-reports/
├── pr-123-20260304.html
├── pr-456-20260304.html
└── ...
```

## 設定

### ポーリング間隔・並列数の変更

`src/config.js` で設定値を変更できます。

| 定数 | デフォルト | 説明 |
|------|-----------|------|
| `POLL_INTERVAL_MS` | `60000` (60秒) | ポーリング間隔 |
| `MAX_CONCURRENT_REVIEWS` | `2` | 最大同時レビュー数 |
| `CLAUDE_TIMEOUT_MS` | `600000` (10分) | Claude CLIのタイムアウト |

### Claude Code の権限設定

初回起動時にClaude CLIが必要なツール（`gh`コマンド、ファイル書き込み等）の許可を求める場合があります。`.claude/settings.json` にプロジェクトスコープの許可ルールを含めていますが、必要に応じて `.claude/settings.local.json` で追加設定してください。

## アーキテクチャ

```
src/
├── index.js                # エントリポイント（preflight checks + Ink render）
├── app.js                  # ルートコンポーネント（ポーリング・キーバインド）
├── config.js               # 設定定数
├── store.js                # EventEmitterベースの状態管理
├── components/
│   ├── header.js           # ヘッダー（タイトル・ポーリング状態）
│   ├── pr-list.js          # PR一覧（ステータスアイコン付き）
│   └── log-panel.js        # アクティビティログ
└── services/
    ├── github-poller.js    # GitHub Search APIポーリング
    ├── claude-runner.js    # Claude CLIプロセス管理
    └── notifier.js         # デスクトップ通知
```

### 動作フロー

1. **Preflight**: `gh`, `claude` CLIの存在と認証状態を確認
2. **ポーリング**: `gh api search/issues` で `review-requested:{user}` のPRを検索
3. **キュー投入**: 新規検出PRをレビューキューに追加
4. **レビュー実行**: `claude --print -p` でpr-review-reportスキルを起動（最大2並列）
5. **レポート保存**: `./review-reports/` にHTMLファイルとして出力
6. **通知**: macOSネイティブ通知でレビュー完了/失敗を通知

## カスタマイズ

### レビュースキルの変更

レビューの内容・フォーマットは `.claude/skills/pr-review-report/` のスキル定義で管理されています。レビュー観点の追加やテンプレートの変更はスキルファイルを編集してください。

## ライセンス

MIT
