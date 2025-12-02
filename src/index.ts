import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

import { ClaudeMdContent, Inputs } from './types';
import { parseActions, getLatestVersion } from './version-checker';
import {
  fetchClaudeMd,
  mergeClaudeMdContent,
  extractExistingSections,
} from './claude-md-fetcher';
import { createPullRequest, checkExistingPR } from './pr-creator';

async function run(): Promise<void> {
  try {
    // Get inputs
    const inputs: Inputs = {
      actions: core.getInput('actions', { required: true }),
      claudeMdPath: core.getInput('claude-md-path') || 'CLAUDE.md',
      githubToken: core.getInput('github-token', { required: true }),
      prBranchPrefix: core.getInput('pr-branch-prefix') || 'update-claude-md/',
      prTitleTemplate:
        core.getInput('pr-title-template') ||
        'Update CLAUDE.md from {action} {version}',
    };

    core.info('Starting gha-claude-md...');

    // Parse actions to monitor
    const actions = parseActions(inputs.actions);
    if (actions.length === 0) {
      core.warning('No valid actions found to monitor');
      return;
    }

    core.info(`Monitoring ${actions.length} action(s):`);
    for (const action of actions) {
      core.info(`  - ${action.owner}/${action.repo} (${action.claudeMdPath})`);
    }

    // Initialize Octokit clients
    const octokit = new Octokit({ auth: inputs.githubToken });
    const ghClient = github.getOctokit(inputs.githubToken);

    // Check for existing open PR
    const existingPR = await checkExistingPR(ghClient, inputs.prBranchPrefix);
    if (existingPR) {
      core.info(`An open PR already exists: ${existingPR}`);
      core.info('Skipping to avoid duplicate PRs. Please merge or close the existing PR first.');
      core.setOutput('pr-url', existingPR);
      return;
    }

    // Read existing CLAUDE.md content
    let existingContent: string | null = null;
    const claudeMdFullPath = path.join(
      process.env.GITHUB_WORKSPACE || '.',
      inputs.claudeMdPath
    );

    if (fs.existsSync(claudeMdFullPath)) {
      existingContent = fs.readFileSync(claudeMdFullPath, 'utf-8');
      core.info(`Found existing ${inputs.claudeMdPath}`);
    } else {
      core.info(`No existing ${inputs.claudeMdPath} found, will create new one`);
    }

    // Extract existing sections to compare versions
    const existingSections = existingContent
      ? extractExistingSections(existingContent)
      : new Map();

    // Fetch CLAUDE.md from each action
    const updates: ClaudeMdContent[] = [];

    for (const action of actions) {
      core.info(`Checking ${action.owner}/${action.repo}...`);

      // Get latest version
      const version = await getLatestVersion(octokit, action);
      if (!version) {
        core.warning(
          `Could not determine version for ${action.owner}/${action.repo}, skipping`
        );
        continue;
      }

      core.info(
        `  Latest version: ${version.latestVersion}`
      );

      // Check if we already have this version
      const actionKey = `${action.owner}/${action.repo}`;
      const existingSection = existingSections.get(actionKey);
      if (existingSection && existingSection.version === version.latestVersion) {
        core.info(`  Already up to date`);
        continue;
      }

      // Fetch CLAUDE.md content
      const claudeMd = await fetchClaudeMd(octokit, version);
      if (!claudeMd) {
        core.info(`  No CLAUDE.md found`);
        continue;
      }

      core.info(`  Found CLAUDE.md (${claudeMd.content.length} bytes)`);
      updates.push(claudeMd);
    }

    // Check if there are any updates
    if (updates.length === 0) {
      core.info('No updates needed, all CLAUDE.md files are up to date');
      core.setOutput('pr-url', '');
      core.setOutput('updated-actions', JSON.stringify([]));
      return;
    }

    core.info(`Found ${updates.length} update(s) to apply`);

    // Merge content
    // Include both updates and existing sections that don't need updates
    const allContent: ClaudeMdContent[] = [...updates];

    // Add existing sections that weren't updated
    for (const [actionKey, section] of existingSections) {
      const wasUpdated = updates.some(
        (u) => `${u.action.owner}/${u.action.repo}` === actionKey
      );
      if (!wasUpdated) {
        const [owner, repo] = actionKey.split('/');
        allContent.push({
          action: { owner, repo, claudeMdPath: 'CLAUDE.md' },
          version: section.version,
          content: section.content,
        });
      }
    }

    const newContent = mergeClaudeMdContent(existingContent, allContent);

    // Create PR
    const result = await createPullRequest(ghClient, {
      branchPrefix: inputs.prBranchPrefix,
      titleTemplate: inputs.prTitleTemplate,
      claudeMdPath: inputs.claudeMdPath,
      newContent,
      updates,
    });

    if (result) {
      const updatedActions = updates.map(
        (u) => `${u.action.owner}/${u.action.repo}@${u.version}`
      );

      core.setOutput('pr-url', result.prUrl);
      core.setOutput('updated-actions', JSON.stringify(updatedActions));

      core.info('');
      core.info('='.repeat(50));
      core.info('Successfully created PR!');
      core.info(`PR URL: ${result.prUrl}`);
      core.info(`Updated actions: ${updatedActions.join(', ')}`);
      core.info('='.repeat(50));
    } else {
      core.setOutput('pr-url', '');
      core.setOutput('updated-actions', JSON.stringify([]));
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
