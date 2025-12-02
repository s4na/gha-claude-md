import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { ActionConfig, ActionVersion } from './types';

export async function getLatestVersion(
  octokit: Octokit,
  action: ActionConfig
): Promise<ActionVersion | null> {
  try {
    // Try to get the latest release first
    try {
      const { data: release } = await octokit.repos.getLatestRelease({
        owner: action.owner,
        repo: action.repo,
      });

      return {
        action,
        latestVersion: release.tag_name,
        latestTag: release.tag_name,
      };
    } catch (releaseError) {
      // If no releases, fall back to tags
      core.debug(`No releases found for ${action.owner}/${action.repo}, trying tags...`);
    }

    // Fall back to getting the latest tag
    const { data: tags } = await octokit.repos.listTags({
      owner: action.owner,
      repo: action.repo,
      per_page: 1,
    });

    if (tags.length === 0) {
      core.warning(`No releases or tags found for ${action.owner}/${action.repo}`);
      return null;
    }

    return {
      action,
      latestVersion: tags[0].name,
      latestTag: tags[0].name,
    };
  } catch (error) {
    core.warning(`Failed to get version for ${action.owner}/${action.repo}: ${error}`);
    return null;
  }
}

export function parseActions(input: string): ActionConfig[] {
  const actions: ActionConfig[] = [];
  const lines = input.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Try to parse as JSON first
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (typeof item === 'string') {
            const config = parseActionString(item);
            if (config) actions.push(config);
          } else if (item.owner && item.repo) {
            actions.push({
              owner: item.owner,
              repo: item.repo,
              claudeMdPath: item.claudeMdPath || 'CLAUDE.md',
            });
          }
        }
        continue;
      } catch {
        // Not JSON, continue to parse as string
      }
    }

    // Parse as "owner/repo" format
    const config = parseActionString(trimmed);
    if (config) {
      actions.push(config);
    }
  }

  return actions;
}

function parseActionString(input: string): ActionConfig | null {
  // Handle formats like:
  // - owner/repo
  // - owner/repo@version (version is ignored, we get latest)
  // - owner/repo:path/to/CLAUDE.md

  let actionPart = input;
  let claudeMdPath = 'CLAUDE.md';

  // Check for custom CLAUDE.md path
  const colonIndex = input.indexOf(':');
  if (colonIndex !== -1 && !input.startsWith('http')) {
    actionPart = input.substring(0, colonIndex);
    claudeMdPath = input.substring(colonIndex + 1);
  }

  // Remove version suffix if present
  const atIndex = actionPart.indexOf('@');
  if (atIndex !== -1) {
    actionPart = actionPart.substring(0, atIndex);
  }

  // Parse owner/repo
  const parts = actionPart.split('/');
  if (parts.length < 2) {
    core.warning(`Invalid action format: ${input}`);
    return null;
  }

  return {
    owner: parts[0],
    repo: parts[1],
    claudeMdPath,
  };
}
