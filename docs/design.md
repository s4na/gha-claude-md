# gha-claude-md 設計書

## 概要

GitHub Actions のバージョンが更新された際に、そのアクションが持つ CLAUDE.md をリポジトリの CLAUDE.md に同期し、PR を自動作成する GitHub Action。

## ユースケース

1. 開発者が使用している GitHub Action（例: `actions/checkout@v4`）がバージョンアップ
2. 新しいバージョンのアクションに含まれる CLAUDE.md の内容が更新されている
3. このアクションが自動的に差分を検知し、CLAUDE.md を更新する PR を作成

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Trigger                               │
│  ・schedule (cron)                                          │
│  ・workflow_dispatch (手動)                                  │
│  ・push (dependabot PRマージ後)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              1. 監視対象アクションの取得                      │
│  ・設定ファイル or inputs から監視対象を読み込み              │
│  ・例: actions/checkout, actions/setup-node など            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              2. 最新バージョンの確認                         │
│  ・GitHub API で各アクションの最新リリースを取得             │
│  ・現在使用中のバージョンと比較                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              3. CLAUDE.md の取得・比較                       │
│  ・最新バージョンのアクションから CLAUDE.md を取得           │
│  ・ローカルの CLAUDE.md と差分を比較                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              4. PR 作成                                      │
│  ・差分があればブランチを作成                                │
│  ・CLAUDE.md を更新してコミット                              │
│  ・PR を作成                                                 │
└─────────────────────────────────────────────────────────────┘
```

## 入力パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `actions` | Yes | - | 監視対象のアクション一覧（JSON配列 or 改行区切り） |
| `claude-md-path` | No | `CLAUDE.md` | 更新先の CLAUDE.md パス |
| `github-token` | Yes | - | PR作成用の GitHub トークン |
| `pr-branch-prefix` | No | `update-claude-md/` | PR用ブランチのプレフィックス |
| `pr-title-template` | No | `Update CLAUDE.md from {action}` | PRタイトルのテンプレート |

## 出力

| 出力 | 説明 |
|------|------|
| `pr-url` | 作成されたPRのURL（複数の場合はJSON配列） |
| `updated-actions` | 更新されたアクションの一覧 |

## ディレクトリ構造

```
gha-claude-md/
├── action.yml              # アクション定義
├── src/
│   ├── index.ts            # エントリーポイント
│   ├── version-checker.ts  # バージョン確認ロジック
│   ├── claude-md-fetcher.ts # CLAUDE.md 取得
│   ├── pr-creator.ts       # PR 作成
│   └── types.ts            # 型定義
├── dist/                   # ビルド成果物
├── docs/
│   └── design.md
├── .github/
│   └── workflows/
│       └── test.yml        # 自身のテスト用ワークフロー
├── package.json
├── tsconfig.json
└── README.md
```

## action.yml 設計

```yaml
name: 'Update CLAUDE.md from Actions'
description: 'Automatically update CLAUDE.md when GitHub Actions are updated'
author: 's4na'

inputs:
  actions:
    description: 'Actions to monitor (JSON array or newline-separated)'
    required: true
  claude-md-path:
    description: 'Path to CLAUDE.md in your repository'
    required: false
    default: 'CLAUDE.md'
  github-token:
    description: 'GitHub token for creating PRs'
    required: true
  pr-branch-prefix:
    description: 'Prefix for PR branches'
    required: false
    default: 'update-claude-md/'
  pr-title-template:
    description: 'Template for PR title. Use {action} and {version} as placeholders'
    required: false
    default: 'Update CLAUDE.md from {action} {version}'

outputs:
  pr-url:
    description: 'URL of created PR(s)'
  updated-actions:
    description: 'List of actions that were updated'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

## 使用例

### 基本的な使い方

```yaml
name: Update CLAUDE.md

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日0時に実行
  workflow_dispatch:      # 手動実行も可能

jobs:
  update-claude-md:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: s4na/gha-claude-md@v1
        with:
          actions: |
            actions/checkout
            actions/setup-node
            anthropics/claude-code-action
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## 処理フロー詳細

### 1. 監視対象アクションの解析

```typescript
interface ActionConfig {
  owner: string;
  repo: string;
  claudeMdPath?: string;  // デフォルト: CLAUDE.md
  currentVersion?: string; // 指定がなければ最新を取得
}

function parseActions(input: string): ActionConfig[] {
  // JSON形式または改行区切りをパース
}
```

### 2. 最新バージョン確認

```typescript
async function getLatestVersion(action: ActionConfig): Promise<string> {
  // GitHub API: GET /repos/{owner}/{repo}/releases/latest
  // または tags を取得して最新を判定
}
```

### 3. CLAUDE.md 取得

```typescript
async function fetchClaudeMd(
  action: ActionConfig,
  version: string
): Promise<string | null> {
  // GitHub API: GET /repos/{owner}/{repo}/contents/{path}?ref={version}
  // CLAUDE.md が存在しない場合は null を返す
}
```

### 4. 差分検出とマージ

```typescript
interface ClaudeMdSection {
  source: string;      // どのアクションから来たか
  version: string;     // バージョン
  content: string;     // セクションの内容
}

function mergeClaudeMd(
  current: string,
  updates: ClaudeMdSection[]
): string {
  // 既存の CLAUDE.md にセクションとして追加/更新
  // 各セクションは <!-- gha-claude-md: {action}@{version} --> でマーク
}
```

### 5. PR 作成

```typescript
async function createPR(
  updates: ActionUpdate[],
  mergedContent: string
): Promise<string> {
  // 1. ブランチ作成
  // 2. CLAUDE.md を更新してコミット
  // 3. PR 作成
  // 4. PR URL を返す
}
```

## CLAUDE.md のマージ形式

更新された CLAUDE.md は以下の形式でマージされる：

```markdown
# CLAUDE.md

## Project-specific instructions

(ユーザーが書いた独自の内容)

---

<!-- gha-claude-md:start -->

## From actions/checkout@v4

(actions/checkout の CLAUDE.md 内容)

## From anthropics/claude-code-action@v1

(claude-code-action の CLAUDE.md 内容)

<!-- gha-claude-md:end -->
```

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| アクションが存在しない | 警告を出力してスキップ |
| CLAUDE.md が存在しない | 警告を出力してスキップ |
| GitHub API レート制限 | リトライまたはエラー終了 |
| PR 作成失敗 | エラー終了（同名ブランチ存在など） |

## セキュリティ考慮事項

1. **GitHub Token のスコープ**: `contents: write` と `pull-requests: write` が必要
2. **信頼できるアクションのみ監視**: 悪意のある CLAUDE.md が注入されないよう注意
3. **PR レビュー必須**: 自動マージは行わず、人間のレビューを必須とする

## 今後の拡張案

1. **Dependabot 連携**: Dependabot の PR をトリガーにして実行
2. **差分のサマリー**: PR 本文に変更点のサマリーを自動生成
3. **カスタムマージ戦略**: セクション単位でのマージ方法をカスタマイズ可能に
4. **Slack/Discord 通知**: 更新があった場合に通知
