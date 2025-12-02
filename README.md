# gha-claude-md

GitHub Action to automatically update CLAUDE.md when monitored GitHub Actions are updated.

## Overview

When the GitHub Actions you use release new versions, this action automatically:
1. Checks for the latest version of each monitored action
2. Fetches the CLAUDE.md from the latest release
3. Compares with your existing CLAUDE.md
4. Creates a PR to update if there are changes

## Usage

### Basic Usage

```yaml
name: Update CLAUDE.md

on:
  schedule:
    - cron: '0 0 * * *'  # Run daily at 00:00 UTC
  workflow_dispatch:      # Allow manual trigger

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

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `actions` | Yes | - | Actions to monitor (newline-separated, e.g., `owner/repo`) |
| `claude-md-path` | No | `CLAUDE.md` | Path to CLAUDE.md in your repository |
| `github-token` | Yes | - | GitHub token for creating PRs |
| `pr-branch-prefix` | No | `update-claude-md/` | Prefix for PR branches |
| `pr-title-template` | No | `Update CLAUDE.md from {action} {version}` | Template for PR title |

### Outputs

| Output | Description |
|--------|-------------|
| `pr-url` | URL of created PR(s) |
| `updated-actions` | JSON array of updated actions |

### Custom CLAUDE.md Path

You can specify a custom path for CLAUDE.md in the monitored action:

```yaml
actions: |
  owner/repo:docs/CLAUDE.md
  another/action:custom/path/CLAUDE.md
```

## How It Works

1. **Parse Actions**: The action parses the list of actions to monitor
2. **Check Versions**: For each action, it fetches the latest release/tag
3. **Compare**: Checks if the CLAUDE.md has been updated since the last sync
4. **Merge**: Merges new content while preserving your custom sections
5. **Create PR**: Creates a pull request with the changes

### CLAUDE.md Format

Your CLAUDE.md will be formatted like this:

```markdown
# Your Project

Your custom content here...

---

<!-- gha-claude-md:start -->

## From actions/checkout@v4

(Content from actions/checkout CLAUDE.md)

## From anthropics/claude-code-action@v1

(Content from claude-code-action CLAUDE.md)

<!-- gha-claude-md:end -->
```

Content between the markers is automatically managed. Your content above the markers is preserved.

## Requirements

- GitHub token with `contents: write` and `pull-requests: write` permissions
- The monitored actions must have a CLAUDE.md file

## License

MIT
