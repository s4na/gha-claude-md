# gha-claude-md

監視対象のGitHub Actionsが更新されたときに、CLAUDE.mdを自動的に更新するGitHub Actionです。

## 概要

使用しているGitHub Actionsの新バージョンがリリースされると、このActionは自動的に以下を実行します：
1. 監視対象の各Actionの最新バージョンをチェック
2. 最新リリースからCLAUDE.mdを取得
3. 既存のCLAUDE.mdと比較
4. 変更があればPRを作成して更新

## 使い方

### 基本的な使い方

```yaml
name: Update CLAUDE.md

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日UTC 00:00に実行
  workflow_dispatch:      # 手動実行を許可

jobs:
  update-claude-md:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
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

### 入力パラメータ

| 入力 | 必須 | デフォルト | 説明 |
|------|------|-----------|------|
| `actions` | はい | - | 監視するAction（改行区切り、例：`owner/repo`） |
| `claude-md-path` | いいえ | `CLAUDE.md` | リポジトリ内のCLAUDE.mdのパス |
| `github-token` | はい | - | PR作成用のGitHubトークン |
| `pr-branch-prefix` | いいえ | `update-claude-md/` | PRブランチのプレフィックス |
| `pr-title-template` | いいえ | `Update CLAUDE.md from {action} {version}` | PRタイトルのテンプレート |

### 出力

| 出力 | 説明 |
|------|------|
| `pr-url` | 作成されたPRのURL |
| `updated-actions` | 更新されたActionのJSON配列 |

### カスタムCLAUDE.mdパス

監視対象のActionでCLAUDE.mdのカスタムパスを指定できます：

```yaml
actions: |
  owner/repo:docs/CLAUDE.md
  another/action:custom/path/CLAUDE.md
```

## 動作の仕組み

1. **Actionの解析**: 監視対象のActionリストを解析
2. **バージョンチェック**: 各Actionの最新リリース/タグを取得
3. **比較**: 前回の同期以降にCLAUDE.mdが更新されたかチェック
4. **マージ**: カスタムセクションを保持しつつ新しいコンテンツをマージ
5. **PR作成**: 変更内容でPull Requestを作成

### CLAUDE.mdのフォーマット

CLAUDE.mdは以下のようにフォーマットされます：

```markdown
# あなたのプロジェクト

あなたのカスタムコンテンツをここに...

---

<!-- gha-claude-md:start -->

## From actions/checkout@v4

（actions/checkoutのCLAUDE.mdの内容）

## From anthropics/claude-code-action@v1

（claude-code-actionのCLAUDE.mdの内容）

<!-- gha-claude-md:end -->
```

マーカー間のコンテンツは自動的に管理されます。マーカーより上のあなたのコンテンツは保持されます。

## 要件

- `contents: write`と`pull-requests: write`権限を持つGitHubトークン
- 監視対象のActionにはCLAUDE.mdファイルが必要

## ライセンス

MIT
